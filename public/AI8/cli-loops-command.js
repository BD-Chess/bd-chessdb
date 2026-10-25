/* Pure command builder shared by the page and its focused Node checks. */
"use strict";
(function(root){
  function build(spec,v){
    if(spec?.schema!=="8zlistener.command_spec.v1")throw Error("Specifikacija ukaza ni dosegljiva.");
    const errors=[],parts=["LOOP"],defaults=spec.defaults,topic=String(v.topic||"").trim();
    const host=v.host||defaults.host,mode=v.mode||defaults.mode,full=v.collaboration==="FullRHP",skeptics=full||v.collaboration==="S";
    if(!["HOME","WORK","VM"].includes(host))errors.push("Izberi veljaven računalnik.");
    if(!["AUTO","MIN","XHIGH","MAX"].includes(mode))errors.push("Izberi AUTO, MIN, XHIGH ali MAX.");
    if(host==="WORK"&&mode==="MIN")errors.push("WORK podpira AUTO/HIGH in MAX; MIN še ni sprejet.");
    if(host==="WORK"&&mode==="XHIGH"&&!(spec.host_modes?.WORK||[]).includes("XHIGH"))errors.push("XHIGH na WORK še ni sprejet; uporabi HOME ali AUTO/MAX.");
    if(!["","S","FullRHP"].includes(v.collaboration||""))errors.push("Neveljaven način sodelovanja.");
    parts.push(host);
    let limit=v.limit||"";
    if(limit==="custom")limit=String(v.customLimit||"")+(v.customUnit||"");
    if(limit){const m=/^([1-9][0-9]*)([hms]?)$/.exec(limit);if(!m)errors.push("Meja mora biti pozitivno število potez ali časa.");else if(m[2]?Number(m[1])*({h:3600,m:60,s:1}[m[2]])>defaults.max_active_seconds:Number(m[1])>defaults.max_turns)errors.push("Največ 100 potez oziroma 12 ur aktivnega dela.");parts.push(limit);}
    if(mode!==defaults.mode)parts.push(mode);
    if(full)parts.push("FullRHP");else if(skeptics)parts.push("S");
    if(v.depth==="DEEP")parts.push("DEEP");
    if(v.build){
      parts.push("B");let project=String(v.buildProject||"").trim();if(project.toUpperCase()==="LISTENER")project="LISTENER";
      const name=String(v.buildPackage||"").trim();
      if(!/^[A-Za-z0-9_-]{1,40}$/.test(project))errors.push("Za B določi veljaven ključ ciljnega projekta.");
      if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name))errors.push("Za B določi ime paketa: črke, številke, _ ali -.");
      if(project)parts.push("PROJECT="+project);if(name)parts.push("PACKAGE="+name);
      if(v.activate){if(project!=="LISTENER")errors.push("ACTIVATE je podprt samo za LISTENER.");parts.push("ACTIVATE");}
    }
    const calls=Number(v.calls||defaults.max_native_calls);
    if(!Number.isInteger(calls)||calls<1||calls>400)errors.push("Meja klicev mora biti med 1 in 400.");
    if(calls!==defaults.max_native_calls)parts.push("CALLS="+calls);
    if(v.tokens!==""&&v.tokens!==undefined&&v.tokens!==null){const n=Number(v.tokens);if(!Number.isInteger(n)||n<1||n>100000000)errors.push("Neveljavna meja tokenov.");else parts.push("TOKENS="+n);}
    const ext=v.ext||"",mal=!!v.mal;
    if((ext||mal)&&!spec.features?.external)errors.push("MAL in ostali LLM-ji pridejo z 8zListener 0.6.0.");
    if(ext&&!["gemini","grok","deepseek","glm","all"].includes(ext))errors.push("Neveljaven zunanji model.");
    if(ext&&host!=="HOME")errors.push("Ostali LLM-ji so zaenkrat samo na HOME.");
    if(ext)parts.push("EXT="+ext);if(mal)parts.push("MAL");
    if(ext)parts.push("EXTUSD="+String(spec.ext_defaults?.usd||"2"),"EXTCALLS="+Number(spec.ext_defaults?.calls||8));
    if(!topic)errors.push("Dodaj temo in želeni rezultat.");
    if(new TextEncoder().encode(topic).length>65536)errors.push("Tema presega 64 KiB; uporabi izvorno datoteko.");
    const seats=full?6:skeptics?4:2;
    return {command:parts.join(" ")+": "+topic,errors,seats,
      summary:host+" · "+mode+" · "+seats+" "+(seats===2?"seji":"sej")+" · "+(v.depth==="DEEP"?"DEEP":"običajna globina")+" · "+(limit||"100 potez / 12 h")+" · "+calls+" klicev"+(full?" · S vključen; avtorja interni RHP-11":"")+(v.build?" · gradnja "+v.buildProject:" · analiza")+(ext?" · EXT "+ext:"")+(mal?" · MAL":"")};
  }
  if(typeof module!=="undefined"&&module.exports)module.exports={build};else root.LoopCommand={build};
})(typeof globalThis!=="undefined"?globalThis:this);
