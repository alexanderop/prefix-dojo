import { herdrMixedDrill } from "../../drills/herdrDrills"
import { drillLesson } from "../helpers"
import type { Lesson } from "../types"
import { lessons as automation } from "./automation"
import { lessons as basics } from "./basics"
import { lessons as workflow } from "./workflow"

export const herdrLessons: Lesson[] = [
  ...basics,
  ...workflow,
  ...automation,
  drillLesson({
    slug: "herdr-drill-mixed",
    track: "herdr",
    module: "Final drill",
    drill: herdrMixedDrill,
  }),
]
