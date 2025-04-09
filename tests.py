import json
import os

chapters = [
    "Entropy, Divergence, and Mutual Information",
    "Codes and sequences",
    "Optimal Codes and Shannon's first theorem",
    "Channel Coding: Shannon's second theorem",
    "Noisy Channels with non-iid input",
]

with open(
    os.path.join("saved_course_jsons", "information_theory.json"),
    "r",
    encoding="utf-8",
) as file:
    theorems = json.load(file)

for i, theorem in enumerate(theorems):
    try:
        topic_num = int(theorem["id"].split()[1][0])-1
        theorems[i]["topic"] = chapters[topic_num]
    except Exception as e:
        print(f"Error processing theorem {i}: {theorem['id']}")
        print(e)

with open(os.path.join("saved_course_jsons", "information_theory_edited.json"), "w+") as f:
    json.dump(theorems, f, indent=4)
