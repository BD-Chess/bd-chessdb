#!/usr/bin/env python3
"""Regenerate display fixtures from pinned GPL-3.0 Lc0 source, not JS.
No engine or network search is run. Requires Python 3 and g++.
"""
import argparse, hashlib, json, pathlib, subprocess, tempfile, urllib.request
PIN = "fd71a2d921b689c5f479d3227c3806c8e272d9c5"
SOURCES = {
 "search.cc": ("src/search/classic/search.cc", "532de4fd114f8ff140ef54732898d9d831ef14c7e0dd671867ae6d3b5501adc6"),
 "fastmath.h": ("src/utils/fastmath.h", "73052fb720e8983fa5a9a630c7dce801201268ac2cfb360f90c1a2bbe0b30281")
}
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument("--source-dir", type=pathlib.Path)
 ap.add_argument("--output", type=pathlib.Path, required=True)
 args=ap.parse_args()
 with tempfile.TemporaryDirectory(prefix="lc0-wdlmu-") as td:
  temp=pathlib.Path(td); source={}
  for name,(path,digest) in SOURCES.items():
   data=(args.source_dir/name).read_bytes() if args.source_dir else urllib.request.urlopen("https://raw.githubusercontent.com/LeelaChessZero/lc0/"+PIN+"/"+path, timeout=30).read()
   if hashlib.sha256(data).hexdigest()!=digest: raise RuntimeError("Source hash mismatch: "+path)
   (temp/name).write_bytes(data);source[name]=data.decode()
  s=source["search.cc"]; start=s.index("inline double WDLRescale("); end=s.index("}  // namespace",start)
  function=s[start:end]
  cpp='#include <algorithm>\n#include <cmath>\n#include <iostream>\n#include "fastmath.h"\nusing namespace lczero;\n'+function+"""
int main() {
 double w,draw,l;
 while(std::cin >> w >> draw >> l) {
  float wl = w-l, d = draw;
  float mu = WDLRescale(wl,d,1.0f,0.0f,1.0f,true,1.4f);
  const float centipawn_fallback_threshold=0.996f;
  float centipawn_score=45*tan(1.56728071628*wl);
  bool use_mu = mu != 0.0f && std::abs(wl)+d < centipawn_fallback_threshold &&
   (std::abs(mu)<1.0f || std::abs(centipawn_score)<std::abs(100*mu));
  int cp = use_mu ? 100*mu : centipawn_score;
  std::cout << cp << " " << use_mu << "\\n";
 }
}
"""
  (temp/"reference.cc").write_text(cpp)
  subprocess.run(["g++","-std=c++17","-O2",str(temp/"reference.cc"),"-o",str(temp/"reference")],check=True)
  cases=[("balanced",[.25,.5,.25]),("white-edge",[.5,.3,.2]),("same-q-low-draw",[.42,.26,.32]),("same-q-high-draw",[.12,.86,.02]),("certain-draw",[0,1,0]),("win-endpoint",[1,0,0]),("loss-endpoint",[0,0,1]),("no-draw",[.65,0,.35]),("almost-certain",[.9998,.0001,.0001])]
  raw_path=pathlib.Path(__file__).resolve().parents[1]/"public/chess-lab/engines/lc0/v0.32.1-maia1900-r8/evidence/native-raw.jsonl"
  raw_bytes=raw_path.read_bytes()
  cases.extend(("maia-native-"+str(i),json.loads(line)["wdl"]) for i,line in enumerate(raw_bytes.decode().splitlines()))
  # Sweep draw rates, both colors, guard boundaries and actual native raw NN samples.
  for d in [.00005,.00011,.001,.01,.1,.3,.5,.8,.95,.99]:
   for f in [.001,.01,.05,.15,.3,.45,.5,.55,.7,.85,.95,.99,.999]:
    w=(1-d)*f;cases.append(("grid-"+str(d)+"-"+str(f),[w,d,1-w-d]))
  inp="".join(" ".join(format(p,".17g") for p in wdl)+"\n" for _,wdl in cases)
  output=subprocess.run([str(temp/"reference")],input=inp,text=True,capture_output=True,check=True).stdout.splitlines()
  payload={"source":"LeelaChessZero/lc0","commit":PIN,"license":"GPL-3.0-or-later; upstream numerical reference only","source_sha256":{name:digest for name,(_,digest) in SOURCES.items()},"maia_raw_sha256":hashlib.sha256(raw_bytes).hexdigest(),"settings":{"ScoreType":"WDL_mu","WDLRescaleRatio":1,"Contempt":0},"cases":[{"id":name,"wdl":wdl,"cp":int(row.split()[0]),"used_mu":row.split()[1]=="1"} for (name,wdl),row in zip(cases,output)]}
  assert len(payload["cases"])==len(cases)
  args.output.parent.mkdir(parents=True,exist_ok=True)
  args.output.write_text(json.dumps(payload,indent=2)+"\n")
  print(json.dumps({"cases":len(cases),"output":str(args.output)}))
if __name__=="__main__":main()

