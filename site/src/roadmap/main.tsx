import { createRoot } from "react-dom/client";
import "../index.css";
import "../site.css";
import "../css/motion.css";
import "./roadmap.css";
import RoadmapApp from "./RoadmapApp";

createRoot(document.getElementById("root")!).render(<RoadmapApp />);
