#!/usr/bin/env python3
"""
Deterministic Nara "Living Cartoon" (Lightly Animated Online Web Comic) Builder (R1).

Hardware Discipline (bd-home-razer):
- Always run under: `taskset -c 14 nice -n 19 python3 scripts/build_living_cartoon.py`
- Zero external dependencies (pure Python 3 stdlib).

Modes:
1. Default (`--pilot-e01`): Generates `public/Nara/living-cartoon-e01-let-me-leave-angry.html`
   (7-panel hybrid storyboard for Illuminara Episode 01 — Let Me Leave Angry:
    4 static high-craft stills P01, P03, P04, P06 + 3 seamless looping cinemagraphs P02, P05, P07,
    instant EN | SL bilingual switching without media reload, Pause Motion accessibility toggle,
    and prefers-reduced-motion support).
2. Daily Story JSON (`--story-json <path> --output <html_path>`):
   Converts any Nara Daily story JSON (moments M01..M03 + optional loop .mp4 overrides)
   into a self-contained Living Cartoon HTML page.
"""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any


E01_PILOT_DATA: dict[str, Any] = {
    "id": "ILLUMINARA-E01-LIVING-CARTOON",
    "kicker_en": "Illuminara · Episode 01 · Living Cartoon Pilot (R1 · 7/7 Live Panels)",
    "kicker_sl": "Illuminara · Epizoda 01 · Živi strip / Living Cartoon (R1 · 7/7 živih kadrov)",
    "title_en": "Let Me Leave Angry",
    "title_sl": "Pusti, da odidem jezna",
    "deck_en": (
        "After returning from a conflict large enough to erase civilizations, Nara enters a rain-dark kitchen "
        "where none of her scale can repair what she missed. All seven panels feature seamless ambient cinemagraph "
        "loops—paced entirely by the reader with instant EN | SL switching."
    ),
    "deck_sl": (
        "Po vrnitvi iz spopada, ki bi lahko izbrisal civilizacije, Nara stopi v z dežjem zatemnjeno kuhinjo, "
        "kjer nič od njene razsežnosti ne more popraviti tega, kar je zamudila. Vseh sedem prizorov je oživljenih "
        "z neskončnimi cinemagraph zankami v ritmu bralca in s takojšnjim preklopom EN | SL."
    ),
    "panels": [
        {
            "id": "P01",
            "num": "01",
            "act_en": "Act I · Good Reasons",
            "act_sl": "I. dejanje · Dobri razlogi",
            "title_en": "Just Rain",
            "title_sl": "Samo dež",
            "subtitle_en": "Adaeze’s kitchen · ordinary rain · three hours after the orbital corridor",
            "subtitle_sl": "Adaezina kuhinja · navaden dež · tri ure po orbitalnem koridorju",
            "mode": "loop",
            "duration": "4.5s",
            "image": "assets/img/i1/I01_S01_just_rain.webp",
            "image_p": "assets/img/i1/I01_S01_just_rain_P.webp",
            "video": "assets/video/i1/E01_P01_just_rain_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P01_just_rain_P_loop.mp4?v=4",
            "alt_en": "Nara stands barefoot in Adaeze’s warm kitchen drying her wet hair with a towel while Adaeze serves stew beneath rain-dark windows and three basil plants.",
            "alt_sl": "Nara stoji bosa v Adaezini topli kuhinji in si z brisačo suši mokre lase, medtem ko Adaeze streže enolončnico pod deževnimi okni in tremi lončnicami bazilike.",
            "narration_top_en": "Three hours earlier she had held an evacuation corridor open between two orbital habitats while a hull fragment the size of a courthouse crossed where her body had been. The field had put her back. Adaeze had made stew.",
            "narration_top_sl": "Tri ure prej je držala odprt evakuacijski koridor med dvema orbitalnima habitatoma, medtem ko je kos trupa v velikosti sodišča prečkal mesto, kjer je bilo njeno telo. Polje jo je sestavilo nazaj. Adaeze je skuhala enolončnico.",
            "bubbles": [
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“You are dripping on my floor.”",
                    "sl": "»Kapljaš mi po tleh.«",
                },
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“I thought I dried.”",
                    "sl": "»Mislila sem, da sem se osušila.«",
                },
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“You thought cosmically.”",
                    "sl": "»Mislila si kozmično.«",
                },
            ],
            "caption_en": "On the windowsill, three basil plants leaned toward the dark glass. AC was not decoration. Nothing glowed because a daughter was sitting across from her mother.",
            "caption_sl": "Na okenski polici so se tri lončnice bazilike nagibale k temnemu steklu. AC ni bil okras. Nič ni žarelo samo zato, ker je hči sedela nasproti svoje matere.",
        },
        {
            "id": "P02",
            "num": "02",
            "title_en": "Good Reasons",
            "title_sl": "Dobri razlogi",
            "subtitle_en": "Two bowls on the table · the blue thermos · the sixth anniversary",
            "subtitle_sl": "Dve skledi na mizi · modra termovka · šesta obletnica",
            "mode": "loop",
            "duration": "4.5s",
            "image": "assets/img/i1/I01_S02_good_reasons.webp",
            "image_p": "assets/img/i1/I01_S02_good_reasons_P.webp",
            "video": "assets/video/i1/E01_P02_good_reasons_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P02_good_reasons_P_loop.mp4?v=4",
            "alt_en": "Warm stew steam rising slowly between two bowls and the weathered blue thermos while rain trickles down the dark kitchen window.",
            "alt_sl": "Topla para se počasi dviga med dvema skledama enolončnice in obrabljeno modro termovko, medtem ko dež polzi po temni kuhinjski šipi.",
            "narration_top_en": "Every year on the morning her father died, Adaeze took coffee in the blue thermos to the harbour wall. Last year a city had been falling. This year fourteen million lives hung inside an orbital conflict zone.",
            "narration_top_sl": "Vsako leto je Adaeze na jutro očetove smrti odnesla kavo v modri termovki na pristaniški zid. Lani je padalo mesto. Letos je bilo v orbitalnem spopadu ujetih štirinajst milijonov življenj.",
            "bubbles": [
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“You missed his day again.”",
                    "sl": "»Spet si zamudila njegov dan.«",
                },
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“I know… I sent you a message. I couldn’t leave.”",
                    "sl": "»Vem … Poslala sem ti sporočilo. Nisem mogla oditi.«",
                },
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“You sent me an explanation. I didn’t ask whether you could. I need you to stop interpreting me.”",
                    "sl": "»Poslala si mi pojasnilo. Nisem vprašala, ali si mogla. Hočem, da me nehaš prevajati.«",
                },
            ],
            "caption_en": "Every sentence of Nara’s explanation was true. Every sentence was unbearable. For the first time, she let the argument remain unsaid.",
            "caption_sl": "Vsak stavek Narinega pojasnila je bil resničen. Vsak stavek je bil neznosen. Prvič je argument pustila neizrečen.",
        },
        {
            "id": "P03",
            "num": "03",
            "title_en": "The Better Argument",
            "title_sl": "Boljši argument",
            "subtitle_en": "Before AC · the court interpreter’s gift and wound",
            "subtitle_sl": "Pred AC · dar in rana sodne tolmačke",
            "mode": "loop",
            "duration": "4.5s",
            "image": "assets/img/i1/I01_S03_the_better_argument.webp",
            "image_p": "assets/img/i1/I01_S03_the_better_argument_P.webp",
            "video": "assets/video/i1/E01_P03_the_better_argument_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P03_the_better_argument_P_loop.mp4?v=4",
            "alt_en": "Nara sits quietly across the kitchen table from Adaeze, who looks down in exhaustion beside the unfinished bowls and blue thermos.",
            "alt_sl": "Nara tiho sedi za kuhinjsko mizo nasproti Adaeze, ki utrujeno gleda navzdol ob nedokončanih skledah in modri termovki.",
            "narration_top_en": "Before AC, Nara had been a court interpreter. She could return anyone’s position clearer than they held it themselves. Once a man had told her: “She gave me my argument back better than I had it. I have never hated anyone more.”",
            "narration_top_sl": "Pred poljem AC je bila Nara sodna tolmačka. Vsakomur je znala vrniti njegovo stališče čistejše, kot ga je imel sam. Nekoč ji je nekdo rekel: »Moj argument mi je vrnila boljši, kot sem ga imel sam. Še nikogar nisem tako sovražil.«",
            "bubbles": [
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“You think I turned him into a scheduling conflict.”",
                    "sl": "»Misliš, da sem ga spremenila v konflikt na urniku.«",
                },
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“No. That is better than what I said. Cleaner. More elegant. You are always sorry at exactly the level where the problem becomes manageable.”",
                    "sl": "»Ne. To je boljše od tistega, kar sem rekla jaz. Čistejše. Bolj elegantno. Vedno ti je žal natanko na ravni, kjer problem postane obvladljiv.«",
                },
            ],
            "caption_en": "Nara could survive inside a star-facing rupture. She had no defence against the possibility that her mother was right.",
            "caption_sl": "Nara je lahko preživela razpoko, obrnjeno proti zvezdi. Ni pa imela obrambe pred možnostjo, da ima njena mati prav.",
        },
        {
            "id": "P04",
            "num": "04",
            "act_en": "Act II · The Larger Room",
            "act_sl": "II. dejanje · Večja soba",
            "title_en": "Do Not Make a Room Around This",
            "title_sl": "Ne delaj sobe okoli tega",
            "subtitle_en": "A coat, a doorway and ten safe minutes",
            "subtitle_sl": "Plašč, prag in deset varnih minut",
            "mode": "loop",
            "duration": "4.5s",
            "image": "assets/img/i1/I01_S04_do_not_make_a_room_around_this.webp",
            "image_p": "assets/img/i1/I01_S04_do_not_make_a_room_around_this_P.webp",
            "video": "assets/video/i1/E01_P04_do_not_make_a_room_around_this_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P04_do_not_make_a_room_around_this_P_loop.mp4?v=4",
            "alt_en": "Adaeze stands at the apartment door holding her coat while Nara remains several steps behind beside the kitchen table.",
            "alt_sl": "Adaeze stoji pri vratih stanovanja s plaščem v roki, medtem ko Nara ostaja nekaj korakov zadaj ob kuhinjski mizi.",
            "narration_top_en": "Adaeze carried her bowl to the sink and took her coat from the chair. Something inside Nara tightened—not fear of danger, but fear of ending. She had already imagined holding ten safe minutes in which neither could leave in anger.",
            "narration_top_sl": "Adaeze je odnesla skledo v korito in vzela plašč s stola. Nekaj v Nari se je stisnilo — ne strah pred nevarnostjo, temveč strah pred koncem. Že si je predstavljala deset varnih minut, v katerih nobena ne bi mogla oditi v jezi.",
            "bubbles": [
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“Nara. Do not make a room around this.”",
                    "sl": "»Nara. Ne delaj sobe okoli tega.«",
                },
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“I wasn’t going to.”",
                    "sl": "»Saj nisem nameravala.«",
                },
            ],
            "caption_en": "Nara felt the lie before she finished believing it—and released the thought. The room remained an ordinary kitchen.",
            "caption_sl": "Nara je začutila laž, še preden ji je do konca verjela — in misel izpustila. Soba je ostala navadna kuhinja.",
        },
        {
            "id": "P05",
            "num": "05",
            "title_en": "Something Wider",
            "title_sl": "Nekaj širšega",
            "subtitle_en": "The first offer of the wide window · a candle beside a sun",
            "subtitle_sl": "Prva ponudba širokega okna · sveča ob soncu",
            "mode": "loop",
            "duration": "4.5s",
            "image": "assets/img/i1/I01_S05_something_wider.webp",
            "image_p": "assets/img/i1/I01_S05_something_wider_P.webp",
            "video": "assets/video/i1/E01_P05_something_wider_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P05_something_wider_P_loop.mp4?v=4",
            "alt_en": "Nara and Adaeze face each other near the kitchen door as the air becomes crystal-clear for half a heartbeat without touching Adaeze.",
            "alt_sl": "Nara in Adaeze stojita druga nasproti druge pri kuhinjskih vratih, ko zrak za pol srčnega utripa postane kristalno jasen, ne da bi se dotaknil Adaeze.",
            "narration_top_en": "For less than a second, Nara touched the threshold. The air became strangely clear—not bright, clear. One surface over a vast, unclaimed presence. She held only the protective edge around the person she loved.",
            "narration_top_sl": "Za manj kot sekundo se je Nara dotaknila praga. Zrak je postal nenavadno jasen — ne svetel, jasen. Ena površina nad neizmerno, neprisvojeno navzočnostjo. Držala je le zaščitni rob okoli človeka, ki ga je imela rada.",
            "bubbles": [
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“I can open something wider than the quiet window. The field holds your boundary while your awareness opens farther. I don’t choose what you encounter. I can’t make you forgive me.”",
                    "sl": "»Lahko odprem nekaj širšega od tihega okna. Polje drži tvojo mejo, medtem ko se tvoja zavest odpre dlje. Ne izbiram, kaj boš srečala. Ne morem te pripraviti, da mi odpustiš.«",
                },
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“What would I see? My husband? … Would I be different?”",
                    "sl": "»Kaj bi videla? Svojega moža? … Bi bila potem drugačna?«",
                },
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“I don’t know. Yes—because experiences change us. A candle beside a sun: protected, not absorbed.”",
                    "sl": "»Ne vem. Da — ker nas izkušnje spremenijo. Sveča ob soncu: zaščitena, ne posrkana.«",
                },
            ],
            "caption_en": "The threshold lasted half a heartbeat. Then Nara let it close. Adaeze had not entered. Nothing had reached her.",
            "caption_sl": "Prag je trajal pol srčnega utripa. Nato ga je Nara zaprla. Adaeze ni vstopila. Nič se je ni dotaknilo.",
        },
        {
            "id": "P06",
            "num": "06",
            "act_en": "Act III · The Door",
            "act_sl": "III. dejanje · Vrata",
            "title_en": "Make the Larger Room Yours",
            "title_sl": "Narediš večjo sobo svojo",
            "subtitle_en": "The threshold remains private · the right to choose the door",
            "subtitle_sl": "Prag ostane zaseben · pravica izbrati vrata",
            "mode": "loop",
            "duration": "4.5s",
            "image": "assets/img/i1/I01_S06_make_the_larger_room_yours.webp",
            "image_p": "assets/img/i1/I01_S06_make_the_larger_room_yours_P.webp",
            "video": "assets/video/i1/E01_P06_make_the_larger_room_yours_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P06_make_the_larger_room_yours_P_loop.mp4?v=4",
            "alt_en": "Adaeze stands in the cold hallway beyond the open apartment door while Nara remains motionless inside the warm rain-dark kitchen.",
            "alt_sl": "Adaeze stoji na hladnem hodniku onkraj odprtih vrat stanovanja, medtem ko Nara nepremično ostaja v topli kuhinji.",
            "narration_top_en": "Adaeze opened the door and cold hallway air entered. Every part of Illuminara that had ever held a collapsing boundary wanted to intervene—to warm the corridor, to open the window just a fraction.",
            "narration_top_sl": "Adaeze je odprla vrata in vstopil je hladen zrak s hodnika. Vsak del Illuminare, ki je kdaj držal razpadajočo mejo, je hotel poseči — ogreti hodnik, odpreti okno le za drobec.",
            "bubbles": [
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“You decide the room needs more complexity. More perspectives. More understanding. And because you can make that room, everyone else looks unreasonable for wanting the door.”",
                    "sl": "»Ti se odločiš, da soba potrebuje več kompleksnosti. Več perspektiv. Več razumevanja. In ker ti lahko narediš takšno sobo, so vsi drugi videti nerazumni, ker hočejo vrata.«",
                },
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“No window. No better version of what I mean. No safe extra minute. I want to leave angry.”",
                    "sl": "»Brez okna. Brez boljše različice tega, kar mislim. Brez varne dodatne minute. Hočem oditi jezna.«",
                },
                {
                    "speaker": "Nara",
                    "side": "left",
                    "en": "“I love you.”",
                    "sl": "»Rada te imam.«",
                },
                {
                    "speaker": "Adaeze",
                    "side": "right",
                    "en": "“I know.”",
                    "sl": "»Vem.«",
                },
            ],
            "caption_en": "Nara stepped back from the doorway. She could preserve everything except the one thing Adaeze had asked for: the right to let the damage become real.",
            "caption_sl": "Nara je stopila korak nazaj od vrat. Ohranila bi lahko vse, razen edine stvari, za katero je prosila Adaeze: pravice, da škoda postane resnična.",
        },
        {
            "id": "P07",
            "num": "07",
            "title_en": "The Window Remained Closed",
            "title_sl": "Okno je ostalo zaprto",
            "subtitle_en": "The crooked basil plant · the notebook afterward",
            "subtitle_sl": "Kriva bazilika · zvezek po odhodu",
            "mode": "loop",
            "duration": "5.0s",
            "image": "assets/img/i1/I01_S07_the_window_remained_closed.webp",
            "image_p": "assets/img/i1/I01_S07_the_window_remained_closed_P.webp",
            "video": "assets/video/i1/E01_P07_the_window_remained_closed_loop.mp4?v=4",
            "video_p": "assets/video/i1/E01_P07_the_window_remained_closed_P_loop.mp4?v=4",
            "alt_en": "Raindrops slide slowly down the dark kitchen window behind Nara as she sits alone beside cooling stew, the blue thermos, and an open notebook.",
            "alt_sl": "Dežne kaplje počasi drsijo po temnem kuhinjskem oknu za Naro, ki sedi sama ob ohlajeni enolončnici, modri termovki in odprtem zvezku.",
            "narration_top_en": "The door closed. No cosmic event followed. It was harder than holding the orbital corridor. On the windowsill, one basil plant had grown crooked toward the light across the street. Nara reached to turn the pot—and stopped. She left it as it was.",
            "narration_top_sl": "Vrata so se zaprla. Noben kozmični dogodek ni sledil. Bilo je težje kot držati orbitalni koridor. Na okenski polici je ena od bazilik zrasla postrani proti luči čez cesto. Nara je segla, da bi lonček obrnila — in se ustavila. Pustila ga je takšnega, kakršen je bil.",
            "bubbles": [
                {
                    "speaker": "Nara · Notebook / Zvezek",
                    "side": "center",
                    "en": "She said no.\nThe window remained closed.",
                    "sl": "Rekla je ne.\nOkno je ostalo zaprto.",
                },
            ],
            "caption_en": "For once she did not improve her mother’s argument. She looked at the two sentences. They were accurate. They were not enough. She let them be enough anyway.",
            "caption_sl": "Tokrat materinega argumenta ni izboljšala. Pogledala je stavka. Bila sta natančna. Nista bila dovolj. Vseeno jima je dovolila, da sta dovolj.",
        },
    ],
}


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def render_living_cartoon_html(data: dict[str, Any]) -> str:
    panels_html: list[str] = []
    for p in data["panels"]:
        pid = esc(p["id"])
        pnum = esc(p["num"])
        is_loop = p.get("mode") == "loop"

        act_banner = ""
        if p.get("act_en"):
            act_banner = f"""
      <div class="lc-act-divider">
        <span data-lang-en>{esc(p["act_en"])}</span>
        <span data-lang-sl hidden>{esc(p.get("act_sl", p["act_en"]))}</span>
      </div>"""

        if is_loop:
            dur = esc(p.get("duration", "4.5s"))
            media_block = f"""
        <div class="lc-media-wrap lc-media-loop" data-loop-panel="{pid}">
          <div class="lc-badge-bar">
            <span class="lc-live-badge">
              <span class="lc-pulse-dot" aria-hidden="true"></span>
              <span data-lang-en>LIVE PANEL · {dur} LOOP</span>
              <span data-lang-sl hidden>ŽIVI KADER · {dur} ZANKA</span>
            </span>
            <button type="button" class="lc-panel-toggle" data-toggle-video="{pid}" aria-label="Toggle panel motion">
              <span data-state-label-en>⏸ Pause</span>
              <span data-state-label-sl hidden>⏸ Ustavi</span>
            </button>
          </div>
          <video class="lc-video" id="video-{pid}" autoplay loop muted playsinline preload="metadata" poster="{esc(p["image"])}" data-video-l="{esc(p["video"])}" data-video-p="{esc(p.get("video_p") or p["video"])}" data-poster-l="{esc(p["image"])}" data-poster-p="{esc(p.get("image_p") or p["image"])}">
            <source src="{esc(p["video"])}" type="video/mp4"/>
          </video>
        </div>"""
        else:
            img_l = esc(p["image"])
            img_p = esc(p.get("image_p") or p["image"])
            media_block = f"""
        <div class="lc-media-wrap lc-media-static">
          <div class="lc-badge-bar">
            <span class="lc-static-badge">
              <span data-lang-en>STILL PANEL · {pnum}</span>
              <span data-lang-sl hidden>STATIČNI KADER · {pnum}</span>
            </span>
          </div>
          <picture class="lc-picture">
            <source media="(orientation: portrait)" srcset="{img_p}" width="1080" height="1920"/>
            <img class="lc-image" loading="lazy" decoding="async" src="{img_l}" alt="{esc(p.get("alt_en", ""))}" width="1672" height="941"/>
          </picture>
        </div>"""

        bubbles_list: list[str] = []
        for b in p.get("bubbles", []):
            side = esc(b.get("side", "left"))
            speaker = esc(b.get("speaker", ""))
            en_lines = "<br/>".join(esc(line) for line in b["en"].split("\n"))
            sl_lines = "<br/>".join(esc(line) for line in b["sl"].split("\n"))
            bubbles_list.append(f"""
          <div class="lc-bubble lc-bubble-{side}">
            <div class="lc-speaker">{speaker}</div>
            <div class="lc-speech" data-lang-en>{en_lines}</div>
            <div class="lc-speech" data-lang-sl hidden>{sl_lines}</div>
          </div>""")
        bubbles_html = "\n".join(bubbles_list)

        panels_html.append(f"""{act_banner}
      <article class="lc-panel {'lc-panel-animated' if is_loop else 'lc-panel-static'}" id="panel-{pid}">
        <header class="lc-panel-header">
          <div class="lc-panel-num">{pnum}</div>
          <div class="lc-panel-titles">
            <h2>
              <span data-lang-en>{esc(p["title_en"])}</span>
              <span data-lang-sl hidden>{esc(p["title_sl"])}</span>
            </h2>
            <p class="lc-panel-sub">
              <span data-lang-en>{esc(p.get("subtitle_en", ""))}</span>
              <span data-lang-sl hidden>{esc(p.get("subtitle_sl", ""))}</span>
            </p>
          </div>
        </header>

        <div class="lc-narration lc-narration-top">
          <p data-lang-en>{esc(p.get("narration_top_en", ""))}</p>
          <p data-lang-sl hidden>{esc(p.get("narration_top_sl", ""))}</p>
        </div>

        {media_block}

        <div class="lc-dialogue-dock">
          {bubbles_html}
        </div>

        <footer class="lc-caption-card">
          <p data-lang-en>{esc(p.get("caption_en", ""))}</p>
          <p data-lang-sl hidden>{esc(p.get("caption_sl", ""))}</p>
        </footer>
      </article>""")

    all_panels = "\n".join(panels_html)

    return f"""<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="theme-color" content="#050811"/>
  <title>{esc(data["title_en"])} — Nara Living Cartoon · Episode 01</title>
  <meta name="description" content="{esc(data["deck_en"])}"/>
  <style>
    :root {{
      --bg-deep: #050811;
      --bg-card: #0c1220;
      --bg-card-elevated: #111a2e;
      --border-subtle: rgba(214, 180, 118, 0.22);
      --border-gold: rgba(235, 195, 120, 0.55);
      --text-main: #eef2f9;
      --text-muted: #a6b3c9;
      --gold-accent: #e5b96e;
      --cyan-accent: #6ec4e5;
      --bubble-nara: rgba(24, 38, 66, 0.92);
      --bubble-adaeze: rgba(44, 29, 24, 0.92);
      --bubble-notebook: rgba(19, 25, 38, 0.96);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: radial-gradient(circle at 50% 0%, #101a30 0%, var(--bg-deep) 65%);
      color: var(--text-main);
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }}
    .lc-topbar {{
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(14px);
      background: rgba(5, 8, 17, 0.86);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0.7rem 1.2rem;
    }}
    .lc-topbar-inner {{
      max-width: 860px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }}
    .lc-brand {{
      display: flex;
      align-items: center;
      gap: 0.65rem;
      color: var(--text-main);
      text-decoration: none;
      font-weight: 700;
      letter-spacing: 0.08em;
      font-size: 0.95rem;
    }}
    .lc-brand-dot {{
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--gold-accent);
      box-shadow: 0 0 10px var(--gold-accent);
    }}
    .lc-controls {{
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }}
    .lc-btn {{
      background: var(--bg-card-elevated);
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      padding: 0.38rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s ease;
    }}
    .lc-btn:hover {{
      border-color: var(--border-gold);
    }}
    .lc-btn.active {{
      background: var(--gold-accent);
      color: #090d16;
      border-color: var(--gold-accent);
    }}
    .lc-container {{
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 1.1rem 5rem;
    }}
    .lc-hero {{
      background: linear-gradient(145deg, rgba(18, 28, 48, 0.92), rgba(10, 15, 27, 0.96));
      border: 1px solid var(--border-gold);
      border-radius: 18px;
      padding: 2rem 1.8rem;
      margin-bottom: 2.5rem;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    }}
    .lc-kicker {{
      color: var(--gold-accent);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.78rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }}
    .lc-hero h1 {{
      font-family: "Georgia", "Times New Roman", serif;
      font-size: clamp(1.9rem, 4vw, 2.75rem);
      margin: 0 0 0.85rem;
      line-height: 1.18;
    }}
    .lc-deck {{
      color: var(--text-muted);
      font-size: 1.04rem;
      margin: 0 0 1.2rem;
    }}
    .lc-jump-nav {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }}
    .lc-jump-link {{
      text-decoration: none;
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 0.3rem 0.65rem;
      font-size: 0.78rem;
    }}
    .lc-jump-link.is-loop {{
      border-color: var(--border-gold);
      color: var(--gold-accent);
    }}
    .lc-act-divider {{
      text-align: center;
      margin: 3rem 0 1.5rem;
      color: var(--gold-accent);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }}
    .lc-panel {{
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 18px;
      margin-bottom: 2.8rem;
      overflow: hidden;
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.5);
    }}
    .lc-panel-animated {{
      border-color: var(--border-gold);
      box-shadow: 0 18px 48px rgba(229, 185, 110, 0.11);
    }}
    .lc-panel-header {{
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.15rem 1.4rem 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }}
    .lc-panel-num {{
      font-family: "Georgia", serif;
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--gold-accent);
      background: rgba(229, 185, 110, 0.12);
      border: 1px solid var(--border-gold);
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }}
    .lc-panel-titles h2 {{
      margin: 0;
      font-size: 1.25rem;
      font-family: "Georgia", serif;
    }}
    .lc-panel-sub {{
      margin: 0.15rem 0 0;
      color: var(--text-muted);
      font-size: 0.84rem;
    }}
    .lc-narration-top {{
      padding: 1rem 1.4rem;
      background: rgba(15, 23, 40, 0.65);
      font-size: 0.97rem;
      color: #dce4f2;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }}
    .lc-narration-top p {{ margin: 0; }}
    .lc-media-wrap {{
      position: relative;
      background: #020409;
      line-height: 0;
    }}
    .lc-image, .lc-video {{
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      display: block;
    }}
    @media (orientation: portrait) {{
      .lc-image, .lc-video {{
        aspect-ratio: 9 / 16;
      }}
    }}
    .lc-badge-bar {{
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      line-height: 1.2;
      pointer-events: none;
    }}
    .lc-live-badge, .lc-static-badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.32rem 0.72rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      backdrop-filter: blur(10px);
    }}
    .lc-live-badge {{
      background: rgba(15, 19, 29, 0.84);
      color: var(--gold-accent);
      border: 1px solid var(--border-gold);
    }}
    .lc-static-badge {{
      background: rgba(10, 14, 22, 0.72);
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }}
    .lc-pulse-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f5b951;
      box-shadow: 0 0 8px #f5b951;
      animation: lcPulse 2s infinite ease-in-out;
    }}
    @keyframes lcPulse {{
      0%, 100% {{ opacity: 1; transform: scale(1); }}
      50% {{ opacity: 0.45; transform: scale(0.85); }}
    }}
    .lc-panel-toggle {{
      pointer-events: auto;
      background: rgba(10, 14, 22, 0.82);
      color: var(--text-main);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 999px;
      padding: 0.28rem 0.68rem;
      font-size: 0.73rem;
      font-weight: 600;
      cursor: pointer;
    }}
    .lc-dialogue-dock {{
      padding: 1.25rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      background: linear-gradient(180deg, rgba(8, 13, 24, 0.95), rgba(13, 20, 35, 0.95));
    }}
    .lc-bubble {{
      max-width: 88%;
      padding: 0.85rem 1.15rem;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      line-height: 1.5;
    }}
    .lc-bubble-left {{
      align-self: flex-start;
      background: var(--bubble-nara);
      border-left: 3px solid var(--cyan-accent);
      border-bottom-left-radius: 4px;
    }}
    .lc-bubble-right {{
      align-self: flex-end;
      background: var(--bubble-adaeze);
      border-right: 3px solid var(--gold-accent);
      border-bottom-right-radius: 4px;
    }}
    .lc-bubble-center {{
      align-self: center;
      text-align: center;
      background: var(--bubble-notebook);
      border: 1px solid var(--border-gold);
      font-family: "Georgia", serif;
      font-size: 1.1rem;
      padding: 1.1rem 1.8rem;
    }}
    .lc-speaker {{
      font-size: 0.73rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--gold-accent);
      margin-bottom: 0.25rem;
    }}
    .lc-bubble-left .lc-speaker {{
      color: var(--cyan-accent);
    }}
    .lc-speech {{
      font-size: 1.01rem;
    }}
    .lc-caption-card {{
      padding: 0.95rem 1.4rem 1.2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      color: var(--text-muted);
      font-style: italic;
      font-size: 0.94rem;
      background: rgba(7, 11, 20, 0.75);
    }}
    .lc-caption-card p {{ margin: 0; }}
    [hidden] {{ display: none !important; }}
    @media (max-width: 600px) {{
      .lc-hero {{ padding: 1.35rem 1.15rem; }}
      .lc-panel-header, .lc-narration-top, .lc-dialogue-dock, .lc-caption-card {{
        padding-left: 1rem;
        padding-right: 1rem;
      }}
      .lc-bubble {{ max-width: 96%; }}
    }}
  </style>
</head>
<body>
  <header class="lc-topbar">
    <div class="lc-topbar-inner">
      <a class="lc-brand" href="illuminara-episode-01-let-me-leave-angry.html">
        <span class="lc-brand-dot" aria-hidden="true"></span>
        <span>NARA · LIVING CARTOON</span>
      </a>
      <div class="lc-controls" role="group" aria-label="Language and motion controls">
        <button type="button" class="lc-btn active" id="btn-lang-en" data-set-lang="en">EN</button>
        <button type="button" class="lc-btn" id="btn-lang-sl" data-set-lang="sl">SL</button>
        <button type="button" class="lc-btn" id="btn-motion-toggle" aria-pressed="false">
          <span data-lang-en>⏸ Pause All Motion</span>
          <span data-lang-sl hidden>⏸ Ustavi vse gibanje</span>
        </button>
      </div>
    </div>
  </header>

  <main class="lc-container">
    <section class="lc-hero">
      <div class="lc-kicker">
        <span data-lang-en>{esc(data["kicker_en"])}</span>
        <span data-lang-sl hidden>{esc(data["kicker_sl"])}</span>
      </div>
      <h1>
        <span data-lang-en>{esc(data["title_en"])}</span>
        <span data-lang-sl hidden>{esc(data["title_sl"])}</span>
      </h1>
      <p class="lc-deck">
        <span data-lang-en>{esc(data["deck_en"])}</span>
        <span data-lang-sl hidden>{esc(data["deck_sl"])}</span>
      </p>
      <nav class="lc-jump-nav" aria-label="Panel navigation">
        <a class="lc-jump-link is-loop" href="#panel-P01">01 · Just Rain (LOOP)</a>
        <a class="lc-jump-link is-loop" href="#panel-P02">02 · Good Reasons (LOOP)</a>
        <a class="lc-jump-link is-loop" href="#panel-P03">03 · The Better Argument (LOOP)</a>
        <a class="lc-jump-link is-loop" href="#panel-P04">04 · Do Not Make a Room (LOOP)</a>
        <a class="lc-jump-link is-loop" href="#panel-P05">05 · Something Wider (LOOP)</a>
        <a class="lc-jump-link is-loop" href="#panel-P06">06 · Larger Room (LOOP)</a>
        <a class="lc-jump-link is-loop" href="#panel-P07">07 · Window Closed (LOOP)</a>
      </nav>
    </section>

    {all_panels}
  </main>

  <script>
    (function() {{
      let currentLang = (new URLSearchParams(window.location.search).get("lang") || "en").toLowerCase() === "sl" ? "sl" : "en";
      let motionPaused = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function applyLanguage(lang) {{
        currentLang = lang;
        document.documentElement.lang = lang;
        document.documentElement.setAttribute("data-lang", lang);
        document.querySelectorAll("[data-lang-en]").forEach(el => {{
          el.hidden = (lang !== "en");
        }});
        document.querySelectorAll("[data-lang-sl]").forEach(el => {{
          el.hidden = (lang !== "sl");
        }});
        document.getElementById("btn-lang-en").classList.toggle("active", lang === "en");
        document.getElementById("btn-lang-sl").classList.toggle("active", lang === "sl");
        updateMotionButtons();
      }}

      function updateMotionButtons() {{
        const globalBtn = document.getElementById("btn-motion-toggle");
        globalBtn.setAttribute("aria-pressed", String(motionPaused));
        globalBtn.classList.toggle("active", motionPaused);
        const enSpan = globalBtn.querySelector("[data-lang-en]");
        const slSpan = globalBtn.querySelector("[data-lang-sl]");
        if (enSpan) enSpan.textContent = motionPaused ? "▶ Resume Motion" : "⏸ Pause All Motion";
        if (slSpan) slSpan.textContent = motionPaused ? "▶ Nadaljuj gibanje" : "⏸ Ustavi vse gibanje";

        document.querySelectorAll("[data-toggle-video]").forEach(btn => {{
          const pid = btn.getAttribute("data-toggle-video");
          const vid = document.getElementById("video-" + pid);
          const paused = !vid || vid.paused;
          const bEn = btn.querySelector("[data-state-label-en]");
          const bSl = btn.querySelector("[data-state-label-sl]");
          if (bEn) {{ bEn.textContent = paused ? "▶ Play" : "⏸ Pause"; bEn.hidden = (currentLang !== "en"); }}
          if (bSl) {{ bSl.textContent = paused ? "▶ Predvajaj" : "⏸ Ustavi"; bSl.hidden = (currentLang !== "sl"); }}
        }});
      }}

      function setAllMotion(pause) {{
        motionPaused = pause;
        document.querySelectorAll("video.lc-video").forEach(v => {{
          if (pause) v.pause();
          else v.play().catch(() => {{}});
        }});
        updateMotionButtons();
      }}

      document.querySelectorAll("[data-set-lang]").forEach(btn => {{
        btn.addEventListener("click", () => applyLanguage(btn.getAttribute("data-set-lang")));
      }});

      document.getElementById("btn-motion-toggle").addEventListener("click", () => {{
        setAllMotion(!motionPaused);
      }});

      const portraitMq = window.matchMedia ? window.matchMedia("(orientation: portrait)") : null;

      function syncDualFrameVideos() {{
        const isPortrait = Boolean(portraitMq ? portraitMq.matches : window.innerHeight > window.innerWidth);
        document.querySelectorAll("video.lc-video[data-video-l]").forEach(vid => {{
          const targetVideo = isPortrait ? (vid.getAttribute("data-video-p") || vid.getAttribute("data-video-l")) : vid.getAttribute("data-video-l");
          const targetPoster = isPortrait ? (vid.getAttribute("data-poster-p") || vid.getAttribute("data-poster-l")) : vid.getAttribute("data-poster-l");
          if (targetPoster && vid.getAttribute("poster") !== targetPoster) {{
            vid.setAttribute("poster", targetPoster);
          }}
          const sourceEl = vid.querySelector("source");
          const currentSrc = (sourceEl && sourceEl.getAttribute("src")) || vid.getAttribute("src") || "";
          if (targetVideo && currentSrc !== targetVideo) {{
            const wasPaused = motionPaused || vid.paused;
            if (sourceEl) sourceEl.setAttribute("src", targetVideo);
            else vid.setAttribute("src", targetVideo);
            vid.load();
            if (!wasPaused) vid.play().catch(() => {{}});
          }}
        }});
      }}

      if (portraitMq && portraitMq.addEventListener) portraitMq.addEventListener("change", syncDualFrameVideos);
      window.addEventListener("resize", syncDualFrameVideos, {{ passive: true }});

      document.querySelectorAll("[data-toggle-video]").forEach(btn => {{
        btn.addEventListener("click", () => {{
          const pid = btn.getAttribute("data-toggle-video");
          const vid = document.getElementById("video-" + pid);
          if (!vid) return;
          if (vid.paused) vid.play().catch(() => {{}});
          else vid.pause();
          updateMotionButtons();
        }});
      }});

      syncDualFrameVideos();
      applyLanguage(currentLang);
      if (motionPaused) setAllMotion(true);
    }})();
  </script>
</body>
</html>
"""


def convert_daily_story_json(story_json_path: Path, loop_map: dict[str, str] | None = None) -> dict[str, Any]:
    raw = json.loads(story_json_path.read_text(encoding="utf-8"))
    loop_map = loop_map or {}
    story_id = raw.get("id") or story_json_path.stem
    title_en = raw.get("title_en") or raw.get("title") or story_id
    title_sl = raw.get("title_sl") or title_en
    moments = raw.get("moments") or raw.get("scenes") or []
    panels: list[dict[str, Any]] = []
    for idx, m in enumerate(moments, start=1):
        mid = f"M0{idx}"
        loop_video = loop_map.get(mid) or m.get("loop_video")
        loop_video_p = loop_map.get(f"{mid}_P") or m.get("loop_video_p") or loop_video
        panels.append({
            "id": mid,
            "num": f"0{idx}",
            "title_en": m.get("title_en") or m.get("title") or f"Moment {idx}",
            "title_sl": m.get("title_sl") or m.get("title") or f"Prizor {idx}",
            "subtitle_en": m.get("subtitle_en", ""),
            "subtitle_sl": m.get("subtitle_sl", ""),
            "mode": "loop" if loop_video else "static",
            "duration": m.get("duration", "4.5s"),
            "image": m.get("image_l") or m.get("image") or "",
            "image_p": m.get("image_p") or m.get("image_l") or m.get("image") or "",
            "video": loop_video or "",
            "video_p": loop_video_p or "",
            "narration_top_en": m.get("narration_en") or m.get("summary_en") or "",
            "narration_top_sl": m.get("narration_sl") or m.get("summary_sl") or "",
            "bubbles": m.get("bubbles") or [],
            "caption_en": m.get("caption_en") or "",
            "caption_sl": m.get("caption_sl") or "",
        })
    return {
        "id": story_id,
        "kicker_en": f"Nara Daily · Living Cartoon · {story_id}",
        "kicker_sl": f"Nara Daily · Živi strip · {story_id}",
        "title_en": title_en,
        "title_sl": title_sl,
        "deck_en": raw.get("deck_en") or raw.get("summary_en") or "",
        "deck_sl": raw.get("deck_sl") or raw.get("summary_sl") or "",
        "panels": panels,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Nara Living Cartoon HTML page.")
    parser.add_argument("--story-json", type=Path, default=None, help="Optional daily story JSON input")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/home/bd/Work/nara-4k-20261107/bd-chessdb/public/Nara/living-cartoon-e01-let-me-leave-angry.html"),
        help="Output HTML file path",
    )
    args = parser.parse_args()

    data = convert_daily_story_json(args.story_json) if args.story_json else E01_PILOT_DATA
    html_out = render_living_cartoon_html(data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html_out, encoding="utf-8")
    print(f"[OK] Built Living Cartoon HTML: {args.output} ({len(html_out)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
