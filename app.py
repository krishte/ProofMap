import json
import os
import random
from io import BytesIO

import networkx as nx
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS  # Import the extension
from networkx.readwrite import json_graph
from pdfminer.high_level import extract_text

from claude import (
    apply_preconditions,
    cluster_topics,
    get_big_json,
    get_preconditions,
    regex_on_theorems,
    remove_dups,
)

# "DEV" or "PROD"
ENV = "DEV"
saved_dir = "saved_course_jsons"
temp_dir = "temp"


app = Flask(__name__)
app.config["CORS_HEADERS"] = "Content-Type"
CORS(app, resources={r"/*": {"origins": "*"}})


def build_graph_conn_comps(claude_list):
    G = nx.DiGraph()
    # Check no two statements have same title
    # assert(len(list(set([thingy['id'] for thingy in claude_list]))) == len(claude_list))

    ### CHECK NO CYCLES

    # BFS on each tree in forest, set starting y based on depth of each BFS
    vertices = [thingy["id"] for thingy in claude_list]
    edges = {thingy["id"]: [] for thingy in claude_list}
    incoming_edges = {thingy["id"]: [] for thingy in claude_list}
    root_node_dependencies = {thingy["id"]: [] for thingy in claude_list}
    # list of (vertex_id, depth)
    searched_set = {thingy["id"]: False for thingy in claude_list}
    depths = {thingy["id"]: -1 for thingy in claude_list}
    root_node_columns = {}
    conn_conp_number = {}

    # edge
    for thingy in claude_list:
        references = thingy["previous_results"]
        for reference in references:
            for thingy2 in claude_list:
                if (
                    reference.lower() == thingy2["id"].lower()
                    or reference.lower() == thingy["name"].lower()
                ):
                    G.add_edge(thingy2["id"], thingy["id"])
                    edges[thingy2["id"]].append(thingy["id"])
                    incoming_edges[thingy["id"]].append(thingy2["id"])

    conn_comps = []

    def find_conn_comps(vertex):
        searched_set[vertex] = True
        comp = [vertex]
        for next_vertex in edges[vertex] + incoming_edges[vertex]:
            if not searched_set[next_vertex]:
                comp.extend(find_conn_comps(next_vertex))
        return comp

    for vertex in vertices:
        if not incoming_edges[vertex]:
            depths[vertex] = 1
            root_node_dependencies[vertex] = [vertex]
        if not searched_set[vertex]:
            conn_comps.append(find_conn_comps(vertex))

    def assign_max_depths(vertex):
        if depths[vertex] != -1:
            return depths[vertex]
        print(vertex, incoming_edges[vertex], depths[vertex])
        depths[vertex] = (
            max(
                [
                    assign_max_depths(prev_vertex)
                    for prev_vertex in incoming_edges[vertex]
                ]
            )
            + 1
        )
        return depths[vertex]

    def assign_root_node_dependencies(vertex):
        if root_node_dependencies[vertex]:
            return root_node_dependencies[vertex]
        root_node_dependencies[vertex] = list(
            set(
                sum(
                    [
                        assign_root_node_dependencies(prev_vertex)
                        for prev_vertex in incoming_edges[vertex]
                    ],
                    [],
                )
            )
        )
        return root_node_dependencies[vertex]

    for i, comp in enumerate(conn_comps):
        column = 0
        for vertex in comp:
            conn_conp_number[vertex] = i
            assign_max_depths(vertex)
            assign_root_node_dependencies(vertex)
            if depths[vertex] == 1:
                root_node_columns[vertex] = column
                column += 1

    print(conn_comps)

    # The idea:
    #  - Each connected component has its own space to work in
    #  - Within each connected component each vertex has a depth characterized by its longest distance to a root
    #  - y coordinate determined solely by depth
    #  - x coordinate determined by connected component and x coordinates of root nodes the theorem depends on

    # vertices
    for thingy in claude_list:

        title = thingy["id"]
        type = thingy["type"]
        name = thingy["name"]
        topic = thingy["topic"]
        statement = thingy["statement"]
        proof = thingy["proof"] if "proof" in thingy else ""

        G.add_node(
            title,
            type=type,
            name=name,
            topic=topic,
            statement=statement,
            proof=proof,
            x=500
            + conn_conp_number[title] * 600
            + np.mean(([root_node_columns[x] for x in root_node_dependencies[title]]))
            * 200,
            y=200 * depths[title],
        )

    # Convert the graph to node-link JSON format
    return json_graph.node_link_data(G, edges="links")


def build_graph_bfs(claude_list):
    G = nx.DiGraph()
    # Check no two statements have same title
    # assert(len(list(set([thingy['id'] for thingy in claude_list]))) == len(claude_list))

    # BFS on each tree in forest, set starting y based on depth of each BFS
    edges = {thingy["id"]: [] for thingy in claude_list}
    # list of (vertex_id, depth)
    searched_set = {thingy["id"]: False for thingy in claude_list}
    depths = {thingy["id"]: -1 for thingy in claude_list}
    ancestors = {thingy["id"]: [] for thingy in claude_list}
    descendants = {thingy["id"]: [] for thingy in claude_list}

    # edge
    for thingy in claude_list:
        references = thingy["previous_results"]
        for reference in references:
            for thingy2 in claude_list:
                if (
                    reference.lower() == thingy2["id"].lower()
                    or reference.lower() == thingy["name"].lower()
                ):
                    G.add_edge(thingy2["id"], thingy["id"])
                    edges[thingy2["id"]].append(thingy["id"])
                    ancestors[thingy["id"]].append(thingy2["id"])
                    descendants[thingy2["id"]].append(thingy["id"])

    def BFS(vertex):
        queue = [(vertex, 1)]

        while len(queue) > 0:
            (current_vertex, current_depth) = queue.pop(0)
            depths[current_vertex] = current_depth

            for next_vertex in edges[current_vertex]:
                if searched_set[next_vertex] == False:
                    searched_set[next_vertex] = True
                    queue.append((next_vertex, current_depth + 1))

    for vertex, found in searched_set.items():
        if not found:
            searched_set[vertex] = True
            BFS(vertex)

    # vertices
    for thingy in claude_list:

        title = thingy["id"]
        type = thingy["type"]
        name = thingy["name"]
        topic = thingy["topic"]
        statement = thingy["statement"]
        proof = thingy["proof"] if "proof" in thingy else ""

        G.add_node(
            title,
            type=type,
            name=name,
            topic=topic,
            statement=statement,
            ancestors=ancestors[title],
            descendants=descendants[title],
            proof=proof,
            x=800 + random.randint(-200, 200),
            y=200 * depths[thingy["id"]],
        )

    # Convert the graph to node-link JSON format
    return json_graph.node_link_data(G, edges="links")


@app.route("/upload", methods=["POST"])
# @cross_origin(origin="*", headers=["Content-Type"])
def pdf_upload():
    if "pdf_file" in request.files:
        pdf_file = request.files["pdf_file"]
        pdf_bytes = pdf_file.read()
        pdf_stream = BytesIO(pdf_bytes)
        text = extract_text(pdf_stream)
        if ENV == "PROD":
            regex_on_theorems(text)
            get_preconditions()
            get_big_json()
            apply_preconditions()
            cluster_topics()
            remove_dups()
        file_path = os.path.join(temp_dir, "final_summary.json")
    else:
        file_path = os.path.join(saved_dir, request.form["saved_file_path"])

    with open(
        file_path,
        "r",
        encoding="utf-8",
    ) as file:
        claude_list = json.load(file)

    json_response = jsonify(
        success=True,
        graph=build_graph_bfs(claude_list),
        theorem_list=claude_list,
    )

    # json_response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5000')
    # json_response.headers.add('Access-Control-Allow-Credentials', 'true')
    # print(json_response)
    return json_response


@app.route("/get_available_courses", methods=["GET"])
def get_available_courses():
    files = os.listdir(saved_dir)
    files = [file for file in files if file.endswith(".json")]
    return jsonify(files=files)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
