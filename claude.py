import ast
import json
import os
import re

import anthropic
from json_repair import repair_json
from tqdm import tqdm

client = anthropic.Anthropic(
    # defaults to os.environ.get("ANTHROPIC_API_KEY")
    api_key="",
)
temp_dir = "temp"


def regex_on_theorems(text):
    def extract_statements(text):
        pattern = re.findall(
            r"(?m)^(?:(?:Theorem|Proposition|Lemma|Example|Corollary|Definition) \d+.*?)(?=\n\n\n|^Proposition \d+|^Theorem \d+|^Lemma \d+|^Example \d+|^Corollary \d+|^Definition \d+|\Z)",
            text,
            re.DOTALL,
        )
        return [match.strip() for match in pattern]

    # Extract theorems, propositions, lemmas, examples, and corollaries
    flashcards = extract_statements(text)

    with open(os.path.join(temp_dir, "data.json"), "w", encoding="utf-8") as json_file:
        json.dump(flashcards, json_file, ensure_ascii=False, indent=4)

    print("Flashcards saved to data.json")

    json_string = json.dumps(flashcards, indent=2)
    return json_string


def get_preconditions():

    with open(os.path.join(temp_dir, "data.json"), "r", encoding="utf-8") as file:
        json_data = json.load(file)

    # Convert the JSON object to a formatted string
    json_string = json.dumps(json_data, indent=2)

    system_prompt = (
        """
    You are an experienced math professionals who is helping me to find connections between various theorems, propositions, corollaries, and lemmas in my lectures notes. Each theorem/proposition/lemmas/corollaries has a list of conditions required to apply the theorem. Here are examples to help you understand what I mean: the preconditions for the theorem \"
    Proposition 1.13. Suppose that f is integrable on [a, b]. Then, for any c with a < c < b, f is Riemann integrable on [a, c] and on [c, b]. Moreover R b f = R c f +
    Rb f.\" is a "function is integrable on a closed interval". The precondition for both \"Continuous functions f : [a, b] → R are integrable.\" and \"Lemma 2.3. Suppose that f : [a, b] → R is a continuous function with f > 0 pointwise and R b f = 0. Then f (x) = 0 for x ∈ [a, b].\" is "function is continuous on a closed interval".  The preconditions for \"
    Proposition 3.3. Let f : [a,b] → R be a function. Let P(i), i = 1,2,... be
    a sequence of partitions with mesh(P(i)) → 0. Then f is integrable if and only if
    limi→∞ Σ(f, P(i), ξ⃗(i)) is equal to some constant c, independently of the choice of
    ξ⃗(i). If this is so, then R b f = c.\" are \"function on a closed interval\" and \"partition with mesh tending to zero\".
    """
        + "Now, Here is the JSON of all the theorems, lemmas, corollaries, and propositions: "
        + json_string
    )

    # print(batch)

    message = client.messages.create(
        model="claude-3-7-sonnet-20250219",
        max_tokens=8192,
        temperature=0,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": 'Given all the theorems, propositions, corollaries, and lemmas I\'ve given you, I want you to extract a list of preconditions from all the theorems, propositions, corolloaries, and lemmas as in the examples I gave you. You will need to output a Python list and absolutely nothing else, where each element in the list is a string precondition. For example: ["function on a closed interval", "partition with mesh tending to zero"]. Be as comprehensive as possible, but remember the goal is to find common preconditions among theorems, so if you see a precondition that you think is too specific and won\'t apply to other theorems, exclude it from the final list.',
                    }
                ],
            }
        ],
    )

    raw_string = message.content[0].text

    with open(os.path.join(temp_dir, "preconditions.txt"), "w+") as f:
        f.write(raw_string)


def get_big_json():

    with open(os.path.join(temp_dir, "data.json"), "r", encoding="utf-8") as file:
        json_data = json.load(file)

    # Convert the JSON object to a formatted string
    json_string = json.dumps(json_data, indent=2)

    system_prompt = (
        """
    You are a document processing and analysis assistant for a theorem visualization project. You will be given a list of strings of statement of the first item and the proof. You will need to use all these theorems to provide structured information about each individual theorem. 

    Here is the JSON of all the theorems: """
        + json_string
    )

    output = []

    n = str(len(json_data))
    print("Starting Claude analysis of " + n + " Statements and nodes")

    batch_size = 5

    for i in tqdm(range(0, len(json_data), batch_size)):

        batch = str(json_data[i : i + batch_size])
        # print(batch)
        not_valid = True
        repetition_count = 0
        while not_valid and repetition_count < 3:
            message = client.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=8192,
                temperature=0.05,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": batch
                                + """. For each of these theorems provide the following information in this exact JSON format:
                                    [{
                                    "type": "theorem" | "proposition" | "lemma" | "example" | "definition" | "corollary",
                                    "id": "The unique identifier of the statement, exactly as it appears (e.g., \"Lemma 40\", \"Theorem 2.42\")",
                                    "name": "The specific name of the statement if explicitly provided (e.g., \"Bolzano-Weierstrass Theorem\"). If no explicit name is given, derive a concise descriptive name (max. 3 words) with no overlap with the id.",
                                    "topic": "The chapter title or topic from the lecture notes where this statement appears",
                                    "previous_results": [
                                        "If the proof or solution requires previous results, list all referenced previous results explicitly by their exact ids (e.g., \"Lemma 35\", \"Theorem 4.41\"). If a reference is mentioned by name instead of id, map that name back to the original exact id and include only the id here. Include implicit dependencies identified through the logic of the proof."
                                    ],
                                    "statement": "Full text of the statement exactly as provided, formatted in LaTeX. Mathematical expressions should be delimited with dollar signs without fail.",
                                    "proof": "Full proof or solution text formatted strictly in valid LaTeX, preserving mathematical syntax such that mathematical expressions are delimited with dollar signs without fail. Ensure the proof is structured logically and is fully parseable as LaTeX, including proper environments, math notation, and references."
                                    }, ...]

                                    The final output should be a JSON of a list and nothing else.""",
                            }
                        ],
                    }
                ],
            )
            try:
                raw_string = message.content[0].text
                clean_string = raw_string.replace("```json\n", "").replace("\n```", "")
                clean_string = clean_string.replace("\\", "\\\\")
                good_json_string = repair_json(clean_string)

                if good_json_string != "":
                    theorem_json = json.loads(good_json_string, strict=False)
                    output = output + theorem_json
                    not_valid = False
            except:
                repetition_count += 1
                print("Attempt", repetition_count, "CLAUDE USELESS: ", clean_string)

    with open(os.path.join(temp_dir, "summary.json"), "w+") as f:
        json.dump(output, f, indent=4)


def apply_preconditions():
    with open(os.path.join(temp_dir, "summary.json"), "r", encoding="utf-8") as file:
        json_data = json.load(file)

    with open(os.path.join(temp_dir, "preconditions.txt"), "r") as f:
        preconditions = f.read()

    system_prompt = (
        """
    You are a mathematician expert that is going to help me list preconditions to apply various theorems, propositions, corollaries, and lemmas.
    Here is a list of preconditions: """
        + preconditions
        + """. For each theorem I give you, I want you to give me a Python list containing the preconditions required by the theorem. Note you can only use preconditions in the list I just gave you, and your output must be stricly a Python list and nothing else. Here are examples to help you understand what I mean: the preconditions for the theorem \"
        Proposition 1.13. Suppose that f is integrable on [a, b]. Then, for any c with a < c < b, f is Riemann integrable on [a, c] and on [c, b]. Moreover R b f = R c f +
        Rb f.\" is a "function is integrable on a closed interval". The precondition for both \"Continuous functions f : [a, b] → R are integrable.\" and \"Lemma 2.3. Suppose that f : [a, b] → R is a continuous function with f > 0 pointwise and R b f = 0. Then f (x) = 0 for x ∈ [a, b].\" is "function is continuous on a closed interval".  The preconditions for \"
        Proposition 3.3. Let f : [a,b] → R be a function. Let P(i), i = 1,2,... be
        a sequence of partitions with mesh(P(i)) → 0. Then f is integrable if and only if
        limi→∞ Σ(f, P(i), ξ⃗(i)) is equal to some constant c, independently of the choice of
        ξ⃗(i). If this is so, then R b f = c.\" are \"function on a closed interval\" and \"partition with mesh tending to zero\". Note that a precondition may be required by a theorem but not stated in an identical manner so be careful not to miss any preconditions. At the same time, a theorem may use the same words as a precondition but not actually require the precondition, so be careful."""
    )

    n = str(len(json_data))
    print("Starting Claude precondition analysis of " + n + " Statements and nodes")

    batch_size = 1

    for i in tqdm(range(0, len(json_data), batch_size)):
        if "statement" not in json_data[i]:
            continue
        batch = str(json_data[i]["statement"])
        not_valid = True
        repetition_count = 0
        while not_valid and repetition_count < 3:
            message = client.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=8192,
                temperature=0,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": batch,
                            }
                        ],
                    }
                ],
            )
            try:
                raw_string = message.content[0].text
                precondition_list = ast.literal_eval(raw_string)
                json_data[i]["preconditions"] = precondition_list
                not_valid = False

            except:
                repetition_count += 1
                print("Attempt", repetition_count, "CLAUDE USELESS: ", raw_string)

    with open(os.path.join(temp_dir, "summary_preconditions.json"), "w+") as f:
        json.dump(json_data, f, indent=4)


def cluster_topics():
    with open(os.path.join(temp_dir, "summary_preconditions.json"), "r") as f:
        data = json.load(f)
        topics = [elem["topic"].lower() for elem in data if "topic" in elem]

    topics = list(set(topics))
    not_valid = True
    repetition_count = 0

    while not_valid and repetition_count < 3:
        message = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=8192,
            temperature=0.05,
            system=[
                {
                    "type": "text",
                    "text": "You are an experienced mathematician helping me to group topics.",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Here is a list of topics from my lecture notes: {str(topics)}. You'll note that some of these topics might have a lot of overlap. As such I want you to cluster these topics into at most 10 synthesized topics and at least 4 synthesized topics that encompass all the topics in my list. You should output a single Python list of tuples where each tuple is a synthesized topic, and a list of all the topics from my original list that fall under the synthesized topic. Note that the lists contained in the second place of each tuple should be pairwise disjoint. Also note your output should be only a Python list and nothing else. ",
                        }
                    ],
                }
            ],
        )

        try:
            raw_string = message.content[0].text
            print(raw_string)
            topic_list = ast.literal_eval(raw_string)
            original_topic_to_synthesized = {}
            for synthesized_topic, subtopics in topic_list:
                for subtopic in subtopics:
                    original_topic_to_synthesized[subtopic] = synthesized_topic

            for elem in data:
                if "topic" in elem:
                    elem["topic"] = original_topic_to_synthesized[elem["topic"].lower()]

            with open(os.path.join(temp_dir, "topic_modded_summary.json"), "w+") as f:
                json.dump(data, f, indent=4)
            not_valid = False
        except Exception as e:
            repetition_count += 1
            print("Attempt", repetition_count, "CLAUDE USELESS: ", raw_string)


def remove_dups():
    with open(os.path.join(temp_dir, "topic_modded_summary.json"), "r") as f:
        data = json.load(f)

    final_elems = []
    required_keys = [
        "type",
        "id",
        "name",
        "topic",
        "previous_results",
        "preconditions",
        "statement",
        "proof",
    ]
    for elem in data:
        ignore = False
        for key in required_keys:
            if key not in elem:
                ignore = True
                break
        if not ignore:
            final_elems.append(elem)

    final_final_elems = []

    for elem in final_elems:
        found = False
        for i, elem2 in enumerate(final_final_elems):
            if elem2["id"] == elem["id"]:
                found = True
                if len(elem["proof"]) > len(elem2["proof"]):
                    final_final_elems[i] = elem
                break
        if not found:
            final_final_elems.append(elem)

    with open(os.path.join(temp_dir, "final_summary.json"), "w+") as f:
        json.dump(final_final_elems, f, indent=4)
