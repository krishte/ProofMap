from pdfminer.high_level import extract_text
from json_repair import repair_json
import json
import os

chapters = [
    "Introduction",
    "Measurable sets and functions",
    "Measures",
    "Independence",
    "Integration",
    "Further results on integration",
    "Conditional expectation",
    "Filtrations and stopping times",
    "Martingales in discrete time",
    "Applications of martingale theory",
]

with open(
    os.path.join("saved_course_jsons", "probability_measure_martingales.json"),
    "r",
    encoding="utf-8",
) as file:
    theorems = json.load(file)

for i, theorem in enumerate(theorems):
    topic_num = int(theorem["id"].split()[1][0])
    theorems[i]["topic"] = chapters[topic_num]

with open(os.path.join("saved_course_jsons", "pmm_edited.json"), "w+") as f:
    json.dump(theorems, f, indent=4)
