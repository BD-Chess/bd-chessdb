/* Keep historical AI8 index deep links working. */
"use strict";
(()=>{const old=new Set(["what","primary-build","primaryBuildStatus","hubPhaseBadge","hubPhaseLabel","hubBuilderBadge","hubBuilderLabel","hubReleaseChannel","hubProjectionTime","hubMilestone","hubMilestoneDate","hubNextStep","lanes","trilogy","mechanisms","evidence","lineage","history","origins","claims","bounded-ridge-challenge"]);function route(){if(old.has(location.hash.slice(1)))location.replace("/ai8/overview.html"+location.search+location.hash)}route();window.addEventListener("hashchange",route)})();
