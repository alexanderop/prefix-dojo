import type { Lesson } from "../types"
import { lessons as automation } from "./automation"
import { lessons as basics } from "./basics"
import { lessons as workflow } from "./workflow"

export const herdrLessons: Lesson[] = [...basics, ...workflow, ...automation]
