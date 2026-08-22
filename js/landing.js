(function () {
    const landing = document.getElementById("landing");
    const logoSvg = document.getElementById("landing-logo");
    const logoGroup = document.getElementById("logo");
    const piecesGroup = document.getElementById("pieces");
    const navItems = document.querySelectorAll(".nav-item");
    const hero = document.querySelector(".hero");
    const brandMark = document.querySelector(".brand-mark");

    const SVG_NS = "http://www.w3.org/2000/svg";

    const fragmentMap = {
        top: { piece: "#piece-top", nav: ".nav-top" },
        left: { piece: "#piece-left", nav: ".nav-left" },
        right: { piece: "#piece-right", nav: ".nav-right" },
        bottom: { piece: "#piece-bottom", nav: ".nav-bottom" }
    };

    // Safari doesn't reliably treat a transparent SVG stroke as "painted"
    // for pointer-events hit-testing the way Firefox/Chrome do, so padding
    // a piece's own tap/hover area with a wide stroke only worked in some
    // browsers — and even where it did, it only padded *outward* from the
    // path's outline, never filling in the concave notches some of these
    // shapes have. Wrapping each piece in a plain rectangle sized to its
    // bounding box (plus the same padding) instead gives every browser an
    // unambiguous, ordinary filled-rect hit target with no gaps — the
    // piece's own path becomes purely visual, not interactive.
    const HIT_PADDING = 50;
    Object.entries(fragmentMap).forEach(([key, config]) => {
        const path = document.querySelector(config.piece);
        const bbox = path.getBBox();

        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("id", path.id);
        group.setAttribute("class", "piece-unit");
        group.dataset.fragment = key;
        group.dataset.href = path.dataset.href;

        const hit = document.createElementNS(SVG_NS, "rect");
        hit.setAttribute("class", "piece-hit");
        hit.setAttribute("x", bbox.x - HIT_PADDING);
        hit.setAttribute("y", bbox.y - HIT_PADDING);
        hit.setAttribute("width", bbox.width + HIT_PADDING * 2);
        hit.setAttribute("height", bbox.height + HIT_PADDING * 2);
        hit.dataset.fragment = key;
        hit.dataset.href = path.dataset.href;

        path.removeAttribute("id");
        path.parentNode.insertBefore(group, path);
        group.appendChild(hit);
        group.appendChild(path);
    });

    const pieceGroups = document.querySelectorAll(".piece-unit");
    const pieceHits = document.querySelectorAll(".piece-hit");

    let isOpen = false;

    // Pieces live inside #landing-logo's viewBox (1080 user units mapped onto
    // a ~140-200px element), so a "px" translate on them is scaled down by
    // that same ratio. This converts a desired on-screen px distance into
    // the user-unit value that actually produces it.
    function getSvgScaleFactor() {
        return 1080 / logoSvg.getBoundingClientRect().width;
    }

    // Each piece is an off-center slice of the assembled logo, so at rest
    // (x:0, y:0) its own bounding-box center already sits away from the
    // logo's center — pieces near the wide edges of the K (left/right) are
    // offset more than top/bottom. Measuring that rest offset lets us cancel
    // it out below so "move the piece to +80px from center" actually lands
    // the piece there, instead of +80px plus whatever it already was off by.
    // Must be called while pieces are still untransformed.
    // The invisible hit-rect built above is deliberately bigger than the
    // piece's own visible shape, so anything sizing/centering itself off
    // "the piece" for visual purposes (rest offsets, hero-overlap
    // avoidance, label placement) needs the path specifically, not the
    // group — the group's own bounding box includes that padding.
    function piecePath(key) {
        return document.querySelector(fragmentMap[key].piece).querySelector(".piece");
    }

    function getPieceRestOffsets() {
        const centerRect = landing.getBoundingClientRect();
        const centerX = centerRect.left + centerRect.width / 2;
        const centerY = centerRect.top + centerRect.height / 2;
        const offsets = {};
        Object.keys(fragmentMap).forEach((key) => {
            const rect = piecePath(key).getBoundingClientRect();
            offsets[key] = {
                x: (rect.left + rect.right) / 2 - centerX,
                y: (rect.top + rect.bottom) / 2 - centerY,
                width: rect.width,
                height: rect.height
            };
        });
        return offsets;
    }

    // A flat, per-piece "nudge the label down a bit" constant (see the
    // labels in getTargets()) is only ever an approximation of how far a
    // *rotated* piece's visual bounding box actually sits from its own
    // unrotated anchor point — close at the pieceScale it was eyeballed
    // at, increasingly off the further vw/vh/pieceScale wander from that
    // (a big screen threw it noticeably off). Measuring the piece's real
    // rendered position and placing the label from that is exact at any
    // size, no per-shape tuning to keep chasing.
    function snapLabelToPiece(key, extraDown) {
        const rect = piecePath(key).getBoundingClientRect();
        const centerRect = landing.getBoundingClientRect();
        const centerX = centerRect.left + centerRect.width / 2;
        const centerY = centerRect.top + centerRect.height / 2;
        const x = (rect.left + rect.right) / 2 - centerX;
        const y = (rect.top + rect.bottom) / 2 - centerY + (extraDown || 0);
        gsap.set(fragmentMap[key].nav, { x, y });
    }

    // Converts a desired on-screen offset (real px, from the logo's center)
    // into the gsap x/y that actually produces it for this piece, at the
    // given rotation/scale. Can't just cancel the piece's scale:1 rest
    // offset the way this used to (desiredX - restOffset) * k — GSAP's
    // combined scale+rotate+translate on this SVG group doesn't move the
    // shape by a simple, origin-independent amount once scale != 1 (a
    // transform-origin/fill-box quirk on the group), and the error grows
    // with both scale and how far the piece's own shape sits from the SVG's
    // coordinate origin — silently landing "bottom" ~170px short of its
    // target at ordinary desktop sizes (visible as the piece appearing over
    // the hero text, then jumping to its real spot once the separate
    // hero-overlap safety net caught up a moment later). A *pure* translate
    // added on top of an already rotated/scaled element IS reliably
    // origin-independent, so measuring the piece's real position after
    // rotation/scale (but before any translate) and computing the
    // remaining delta from THAT stays exact regardless of scale.
    function pieceOffset(key, desiredX, desiredY, rotation, scale, k) {
        const group = document.querySelector(fragmentMap[key].piece);
        const el = piecePath(key);
        const centerRect = landing.getBoundingClientRect();
        const centerX = centerRect.left + centerRect.width / 2;
        const centerY = centerRect.top + centerRect.height / 2;

        gsap.set(group, { x: 0, y: 0, rotation, scale });
        const rect = el.getBoundingClientRect();
        const scaledX = (rect.left + rect.right) / 2 - centerX;
        const scaledY = (rect.top + rect.bottom) / 2 - centerY;
        gsap.set(group, { x: 0, y: 0, rotation: 0, scale: 1 });

        return {
            x: (desiredX - scaledX) * k,
            y: (desiredY - scaledY) * k
        };
    }

    const MOBILE_BREAKPOINT = 640;

    // On narrow phones the N/S/E/W cross leaves left/right almost no room
    // (portrait width is the tight axis), so instead: projets + contact
    // form a top row, à propos + fragile a bottom row, bienvenue stays
    // centered between them.
    function getMobileTargets(vw, vh, k, restOffsets) {
        const pieceScale = 0.85;
        const rowBuffer = 140;
        const colBuffer = 80;
        const rowOffset = Math.min(vh * 0.28, vh / 2 - rowBuffer);
        const colOffset = Math.min(vw * 0.2, vw / 2 - colBuffer);

        const pieces = {
            top: { ...pieceOffset("top", -colOffset, -rowOffset, -6, pieceScale, k), rotation: -6, scale: pieceScale },
            right: { ...pieceOffset("right", colOffset, -rowOffset, 8, pieceScale, k), rotation: 8, scale: pieceScale },
            left: { ...pieceOffset("left", -colOffset, rowOffset, -8, pieceScale, k), rotation: -8, scale: pieceScale },
            bottom: { ...pieceOffset("bottom", colOffset, rowOffset, 6, pieceScale, k), rotation: 6, scale: pieceScale }
        };

        // The label rides on the piece itself — same raw on-screen offset
        // used to place the piece, so it lands exactly where snapLabelToPiece
        // (which measures the piece's real center once it's settled) will
        // put it too — a separate nudged approximation here used to make the
        // label visibly jump to the unnudged spot the moment that measured
        // correction landed.
        const labels = {
            top: { x: -colOffset, y: -rowOffset },
            right: { x: colOffset, y: -rowOffset },
            left: { x: -colOffset, y: rowOffset },
            bottom: { x: colOffset, y: rowOffset }
        };

        return { pieces, labels };
    }

    function getTargets() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const k = getSvgScaleFactor();
        const restOffsets = getPieceRestOffsets();

        if (vw < MOBILE_BREAKPOINT) {
            return getMobileTargets(vw, vh, k, restOffsets);
        }

        // On a narrow phone screen there just isn't 170px to spare on each
        // side, so the piece's own on-screen size and the edge buffer both
        // scale down with viewport width — and, since a resized desktop
        // window can end up short rather than narrow, with height too, or
        // the pieces could stay full-size in a window with no vertical room
        // left for them at all.
        const pieceScale = Math.min(2.4, Math.max(0.65, Math.min(vw / 480, vh / 420)));

        // Visual (on-screen px) positions — used for the label math below.
        // The buffer keeps the piece's own footprint (scaled by pieceScale)
        // plus its label clear of the viewport edge — this is a hard
        // ceiling, pieces must never be pushed past it or they clip off-screen.
        // Floored well above 0: on a short/narrow-enough window vh/2 or vw/2
        // minus buffer can otherwise go negative, which flips marginX/Y
        // negative too and throws pieces to the wrong side of center instead
        // of just packing them in tighter.
        const buffer = Math.max(Math.min(170, Math.max(50, Math.min(vw, vh) * 0.13)), 95 * pieceScale);
        const edgeCapX = Math.max(80, vw / 2 - buffer);
        const edgeCapY = Math.max(60, vh / 2 - buffer);

        // Within that ceiling, try to also clear the hero text block so the
        // right/bottom piece + label don't land on top of it on narrower
        // viewports. The clearance has to account for the piece's own
        // footprint too — marginX/Y position its center, but its edge
        // reaches further toward the hero than that center point.
        const heroRect = hero.getBoundingClientRect();
        const gap = 40;
        const pieceHalfW = Math.max(restOffsets.left.width, restOffsets.right.width) / 2 * pieceScale;
        const pieceHalfH = Math.max(restOffsets.top.height, restOffsets.bottom.height) / 2 * pieceScale;
        const heroClearanceX = heroRect.width / 2 + gap + pieceHalfW;
        const heroClearanceY = heroRect.height / 2 + gap + pieceHalfH;

        const marginX = Math.min(Math.max(vw * 0.28, heroClearanceX), 460, edgeCapX);
        const marginY = Math.min(Math.max(vh * 0.26, heroClearanceY), 360, edgeCapY);
        // Symmetric with top now — the flat extra push this used to get
        // kept getting nudged down to nothing anyway.
        const marginYBottom = Math.min(marginY + 90, edgeCapY);

        // Pieces are transformed inside the SVG's own coordinate space, so
        // their targets need the scale-factor correction to land at the
        // same visual distance as marginX/marginY.
        const pieces = {
            top: { ...pieceOffset("top", 0, -marginY, -6, pieceScale, k), rotation: -6, scale: pieceScale },
            bottom: { ...pieceOffset("bottom", 0, marginYBottom, 6, pieceScale, k), rotation: 6, scale: pieceScale },
            left: { ...pieceOffset("left", -marginX, 0, -14, pieceScale, k), rotation: -14, scale: pieceScale },
            right: { ...pieceOffset("right", marginX, 0, 14, pieceScale, k), rotation: 14, scale: pieceScale }
        };

        // The label rides directly on its piece — same raw on-screen offset
        // used to place the piece, so it lands exactly where snapLabelToPiece
        // (which measures the piece's real center once it's settled) will
        // put it too — a separate nudged approximation here used to make the
        // label visibly jump to the unnudged spot the moment that measured
        // correction landed.
        const labels = {
            top: { x: 0, y: -marginY },
            bottom: { x: 0, y: marginYBottom },
            left: { x: -marginX, y: 0 },
            right: { x: marginX, y: 0 }
        };

        return { pieces, labels };
    }

    function setInitialState() {
        gsap.set(landing, { backgroundColor: "#000" });
        gsap.set("body", { backgroundColor: "#000" });
        gsap.set(logoSvg, { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" });
        gsap.set(logoGroup, { opacity: 1 });
        gsap.set(piecesGroup, { opacity: 0 });
        gsap.set(pieceGroups, { x: 0, y: 0, rotation: 0, scale: 1 });
        gsap.set(navItems, { opacity: 0, x: 0, y: 0, xPercent: -50, yPercent: -50 });
        gsap.set(hero, { opacity: 0, x: 0, y: 16, xPercent: -50, yPercent: -50 });
        gsap.set(brandMark, { opacity: 0, y: -10 });
        landing.classList.remove("is-open");
    }

    // x, y and rotation each run on their own out-of-sync period, so the
    // combined path drifts like a Lissajous curve instead of oscillating
    // back and forth along one straight in/out line.
    const FLOAT_CONFIG = {
        top: { x: 10, y: -14, rot: -4, durX: 6.4, durY: 5.1, durR: 7.3 },
        left: { x: -16, y: 10, rot: -6, durX: 5.5, durY: 6.7, durR: 6.0 },
        right: { x: 16, y: 10, rot: 6, durX: 6.9, durY: 5.6, durR: 6.5 },
        bottom: { x: -10, y: 14, rot: 4, durX: 5.8, durY: 7.1, durR: 5.4 }
    };

    function floatPiece(key) {
        const k = getSvgScaleFactor();
        const { x, y, rot, durX, durY, durR } = FLOAT_CONFIG[key];
        const piece = fragmentMap[key].piece;
        const nav = fragmentMap[key].nav;
        const tweenOpts = { repeat: -1, yoyo: true, ease: "sine.inOut" };

        gsap.to(piece, { x: `+=${x * k}`, duration: durX, ...tweenOpts });
        gsap.to(piece, { y: `+=${y * k}`, duration: durY, ...tweenOpts });
        gsap.to(piece, { rotation: `+=${rot}`, duration: durR, ...tweenOpts });

        // the label rides along with its piece so it reads as one unit
        gsap.to(nav, { x: `+=${x}`, duration: durX, ...tweenOpts });
        gsap.to(nav, { y: `+=${y}`, duration: durY, ...tweenOpts });
    }

    function startFloating() {
        Object.keys(FLOAT_CONFIG).forEach(floatPiece);
    }

    // Final safety net: the target math predicts clearance from the hero
    // block, but predictions can be wrong (font metrics, layout quirks). This
    // checks the real, currently-rendered rects and nudges any piece that
    // still overlaps the hero straight out along its own axis.
    function avoidHeroOverlap() {
        const heroRect = hero.getBoundingClientRect();
        if (!heroRect.width || !heroRect.height) return;
        const gap = 24;
        const guard = {
            left: heroRect.left - gap,
            top: heroRect.top - gap,
            right: heroRect.right + gap,
            bottom: heroRect.bottom + gap
        };

        Object.entries(fragmentMap).forEach(([key, config]) => {
            const group = document.querySelector(config.piece);
            const nav = document.querySelector(config.nav);
            const box = piecePath(key).getBoundingClientRect();

            const overlapsX = box.left < guard.right && box.right > guard.left;
            const overlapsY = box.top < guard.bottom && box.bottom > guard.top;
            if (!overlapsX || !overlapsY) return;

            let dx = 0;
            let dy = 0;
            if (key === "top") dy = -(box.bottom - guard.top);
            else if (key === "bottom") dy = guard.bottom - box.top;
            else if (key === "left") dx = -(box.right - guard.left);
            else if (key === "right") dx = guard.right - box.left;

            // The idle float (see floatPiece) has its own repeating x/y
            // tweens on this element with a fixed end point set when it
            // started — nudging x/y on top of that just fights it (visible
            // as jittery motion) and the float drags the piece back through
            // the old, overlapping position on its next cycle. Kill it,
            // apply the correction as the new resting position, then
            // restart the float from there — once BOTH the piece's and the
            // nav's correction tween have actually finished (an onComplete
            // on just the piece's raced the nav's own still-running one,
            // which floatPiece()'s relative += tweens could cut off before
            // it landed, leaving the nav adrift from a not-quite-corrected
            // spot).
            // dx/dy are real on-screen px (from getBoundingClientRect). The
            // nav label is a plain HTML element, so it takes them as-is —
            // but the piece group lives inside the SVG's viewBox coordinate
            // space, so its gsap x/y need the same px→viewBox-unit scaling
            // pieceOffset() applies everywhere else, or the correction lands
            // scaled down by k and barely dents the overlap.
            const k = getSvgScaleFactor();
            gsap.killTweensOf(group);
            gsap.killTweensOf(nav);
            gsap.to(group, { x: `+=${dx * k}`, y: `+=${dy * k}`, duration: 0.4, ease: "power2.out" });
            gsap.to(nav, { x: `+=${dx}`, y: `+=${dy}`, duration: 0.4, ease: "power2.out" });
            // The nav's own "+=dx/dy" slide is only ever an approximation of
            // where the piece actually lands (float's relative oscillation
            // getting killed mid-cycle repeatedly, across possibly several
            // of these corrections in a row, doesn't reliably keep the two
            // in lockstep) — resync it to the piece's real measured position
            // before letting float take over again, or small mismatches
            // accumulate into a visibly detached label over several checks.
            gsap.delayedCall(0.4, () => {
                snapLabelToPiece(key);
                floatPiece(key);
            });
        });
    }

    // Google Fonts can swap in a heavier/wider weight well after
    // document.fonts.ready resolves (each family/weight in the stack loads
    // independently), which silently reflows the hero block again. Re-check
    // a few times over the following seconds rather than trusting a single
    // "fonts are ready now" signal.
    let heroOverlapTimers = [];
    function scheduleHeroOverlapChecks() {
        // Dragging a window edge fires resize repeatedly — without this, each
        // resize would stack its own batch of checks on top of the previous
        // batch's, all correcting against different in-between layouts at once.
        heroOverlapTimers.forEach((timer) => timer.kill());
        heroOverlapTimers = [0.1, 0.5, 1, 2, 3.5].map((t) => gsap.delayedCall(t, avoidHeroOverlap));
    }

    function openLanding() {
        if (isOpen) return;
        isOpen = true;

        const { pieces: pieceTargets } = getTargets();
        const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });

        tl.to(landing, { backgroundColor: "#fff", duration: 0.8 }, 0)
            .to("body", { backgroundColor: "#fff", duration: 0.8 }, 0)
            .to(logoSvg, { scale: 1.06, duration: 0.9, ease: "power3.out" }, 0.05)
            .to(piecesGroup, { opacity: 1, duration: 0.15 }, 0.45)
            .to(logoGroup, { opacity: 0, duration: 0.3 }, 0.48)
            .add(() => landing.classList.add("is-open"), 0.5);

        // The label doesn't get its own separate tween toward getTargets()'s
        // analytical approximation of where the piece will land — that
        // approximation is never quite exact, so the label used to visibly
        // hop the moment a later correction replaced it with the piece's
        // real position. Driving it from the piece's own tween instead (every
        // frame, via onUpdate) keeps it exactly glued to the piece's real
        // rendered position throughout the whole flight, not just at the end.
        Object.entries(pieceTargets).forEach(([key, target]) => {
            tl.to(`#piece-${key}`, {
                x: target.x,
                y: target.y,
                rotation: target.rotation,
                scale: target.scale,
                duration: 2.1,
                ease: "expo.out",
                onUpdate: () => snapLabelToPiece(key)
            }, 0.55);
        });

        Object.keys(pieceTargets).forEach((key) => {
            tl.call(() => floatPiece(key), null, 0.55 + 2.1 + 0.05);
        });

        tl.to(hero, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" }, 1.4)
            .to(brandMark, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 1.4)
            .to(navItems, { opacity: 1, stagger: 0.08, duration: 0.6, ease: "power2.out" }, 1.5)
            .call(scheduleHeroOverlapChecks, null, 2.7);
    }

    // Used when arriving from another page (e.g. a "retour" link) — jumps
    // straight to the open state instead of replaying the reveal animation.
    function openLandingInstant() {
        if (isOpen) return;
        isOpen = true;

        gsap.set(landing, { backgroundColor: "#fff" });
        gsap.set("body", { backgroundColor: "#fff" });
        gsap.set(logoSvg, { scale: 1.06 });
        gsap.set(logoGroup, { opacity: 0 });
        landing.classList.add("is-open");
        gsap.set(hero, { opacity: 1, y: 0 });
        gsap.set(brandMark, { opacity: 1, y: 0 });

        // Positions depend on the hero text's real (post-web-font) size —
        // computing them right on "load" (before Newsreader has necessarily
        // finished downloading) placed pieces/labels off the fallback-font
        // measurements, and letting a later repositionOpen() patch it up
        // raced against the floating idle animation this same function was
        // about to start, leaving labels stuck at the wrong spot. Settling
        // this in one pass, after fonts are actually ready, avoids both.
        const settle = () => {
            const { pieces: pieceTargets } = getTargets();

            Object.entries(pieceTargets).forEach(([key, target]) => {
                gsap.set(`#piece-${key}`, {
                    x: target.x,
                    y: target.y,
                    rotation: target.rotation,
                    scale: target.scale
                });
            });

            // Pieces are already in their final spot (gsap.set, not
            // animated) — snap labels straight to the real measured
            // position rather than the analytical labelTargets guess.
            Object.keys(pieceTargets).forEach((key) => snapLabelToPiece(key));

            gsap.set(piecesGroup, { opacity: 1 });
            gsap.set(navItems, { opacity: 1 });

            startFloating();
            scheduleHeroOverlapChecks();
        };

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(settle);
        } else {
            settle();
        }
    }

    // Recomputes and re-animates pieces/labels to their target for the
    // current viewport — keeps the layout live-responsive instead of
    // freezing everything at whatever size the window was when it opened.
    function repositionOpen() {
        if (!isOpen) return;

        gsap.killTweensOf(pieceGroups);
        gsap.killTweensOf(navItems);

        // getPieceRestOffsets() (called inside getTargets()) only measures
        // correctly while pieces sit untransformed at their rest position —
        // but by the time a resize/rotation calls repositionOpen(), they're
        // already spread out from the last layout. Without resetting them
        // first, it measures the wrong reference point and every position
        // comes out wrong, compounding further on each subsequent resize.
        gsap.set(pieceGroups, { x: 0, y: 0, rotation: 0, scale: 1 });

        const { pieces: pieceTargets } = getTargets();

        // The label isn't tweened toward its own separately-computed target —
        // that's never quite exact, so it used to visibly hop the moment a
        // later correction replaced it with the piece's real position.
        // Driving it every frame from the piece's own tween keeps it glued
        // to the piece's real rendered position throughout the move, not
        // just once the piece settles.
        Object.entries(pieceTargets).forEach(([key, target]) => {
            gsap.to(fragmentMap[key].piece, {
                x: target.x,
                y: target.y,
                rotation: target.rotation,
                scale: target.scale,
                duration: 0.5,
                ease: "power2.out",
                onUpdate: () => snapLabelToPiece(key)
            });
        });

        gsap.delayedCall(0.55, startFloating);
        gsap.delayedCall(0.6, scheduleHeroOverlapChecks);
    }

    // Splits the piece into an irregular fan of triangular shards radiating
    // from its center — like cracked glass — that burst outward, spin and
    // fade, plus a quick flash at the point of impact. `path` is the
    // visible piece path (not the wrapping group or its hit-rect).
    function shatterPiece(path, fragmentKey) {
        const bbox = path.getBBox();
        const d = path.getAttribute("d");
        const fill = getComputedStyle(path).fill;
        const pieceCx = bbox.x + bbox.width / 2;
        const pieceCy = bbox.y + bbox.height / 2;
        const radius = Math.hypot(bbox.width, bbox.height); // clears every corner

        // Irregular crack lines: mostly-even angles with random jitter, not
        // a perfectly even pizza-slice fan.
        const shardCount = 9;
        const step = (Math.PI * 2) / shardCount;
        const angles = Array.from({ length: shardCount }, (_, i) => i * step + (Math.random() - 0.5) * step * 0.7);
        angles.push(angles[0] + Math.PI * 2);

        let defs = logoSvg.querySelector("defs");
        if (!defs) {
            defs = document.createElementNS(SVG_NS, "defs");
            logoSvg.prepend(defs);
        }

        const shardGroup = document.createElementNS(SVG_NS, "g");
        shardGroup.setAttribute("class", "shard-group");

        for (let i = 0; i < shardCount; i++) {
            const a1 = angles[i];
            const a2 = angles[i + 1];
            const aMid = (a1 + a2) / 2;
            const p1x = pieceCx + radius * Math.cos(a1);
            const p1y = pieceCy + radius * Math.sin(a1);
            const p2x = pieceCx + radius * Math.cos(a2);
            const p2y = pieceCy + radius * Math.sin(a2);

            const clipId = `shard-clip-${fragmentKey}-${i}`;
            const clip = document.createElementNS(SVG_NS, "clipPath");
            clip.setAttribute("id", clipId);
            const wedge = document.createElementNS(SVG_NS, "polygon");
            wedge.setAttribute("points", `${pieceCx},${pieceCy} ${p1x},${p1y} ${p2x},${p2y}`);
            clip.appendChild(wedge);
            defs.appendChild(clip);

            const shard = document.createElementNS(SVG_NS, "g");
            shard.setAttribute("clip-path", `url(#${clipId})`);
            shard.style.transformBox = "view-box";
            const shardPath = document.createElementNS(SVG_NS, "path");
            shardPath.setAttribute("d", d);
            shardPath.setAttribute("fill", fill);
            shard.appendChild(shardPath);
            shardGroup.appendChild(shard);

            const dist = bbox.width * 0.5 + bbox.height * 0.5;
            const flyX = Math.cos(aMid) * dist * (0.8 + Math.random() * 0.9);
            const flyY = Math.sin(aMid) * dist * (0.8 + Math.random() * 0.9);

            gsap.set(shard, { transformOrigin: `${pieceCx}px ${pieceCy}px` });
            gsap.timeline()
                .to(shard, {
                    x: Math.cos(aMid) * dist * 0.18,
                    y: Math.sin(aMid) * dist * 0.18,
                    scale: 1.06,
                    duration: 0.09,
                    ease: "power1.out"
                })
                .to(shard, {
                    x: flyX,
                    y: flyY,
                    rotation: (Math.random() - 0.5) * 220,
                    scale: 0.6,
                    opacity: 0,
                    duration: 0.55 + Math.random() * 0.25,
                    ease: "power3.out"
                });
        }

        // A quick radial flash at the point of impact.
        const flash = document.createElementNS(SVG_NS, "circle");
        flash.setAttribute("cx", pieceCx);
        flash.setAttribute("cy", pieceCy);
        flash.setAttribute("r", Math.max(bbox.width, bbox.height) * 0.12);
        flash.setAttribute("fill", "#fff");
        flash.setAttribute("class", "shard-flash");
        shardGroup.appendChild(flash);
        gsap.set(flash, { transformOrigin: `${pieceCx}px ${pieceCy}px`, opacity: 0.9 });
        gsap.to(flash, { scale: radius / (Math.max(bbox.width, bbox.height) * 0.12) * 0.6, opacity: 0, duration: 0.35, ease: "power2.out" });

        // The path lives inside the piece's <g> (which carries the actual
        // GSAP position/rotation/scale) — inserting the shard group as a
        // sibling there means it inherits that same transform for free, no
        // need to read and re-apply it explicitly.
        path.parentNode.insertBefore(shardGroup, path.nextSibling);
        shardGroup.style.transformBox = "view-box";
        gsap.set(shardGroup, { transformOrigin: `${pieceCx}px ${pieceCy}px` });

        gsap.set(path, { opacity: 0 });

        gsap.delayedCall(1.1, () => shardGroup.remove());
    }

    const RESPAWN_DELAY = 4.5;

    function respawnPiece(group, key) {
        delete group.dataset.broken;
        const hit = group.querySelector(".piece-hit");
        hit.style.pointerEvents = "";
        gsap.to(group.querySelector(".piece"), { opacity: 1, duration: 0.6, ease: "power2.out" });

        const nav = document.querySelector(fragmentMap[key].nav);
        nav.style.pointerEvents = "";
        gsap.to(nav, { opacity: 1, duration: 0.6, ease: "power2.out" });

        floatPiece(key);
    }

    function breakPiece(group) {
        if (group.dataset.broken) return;
        group.dataset.broken = "true";

        const key = group.dataset.fragment;
        shatterPiece(group.querySelector(".piece"), key);
        group.querySelector(".piece-hit").style.pointerEvents = "none";

        const config = fragmentMap[key];
        if (!config) return;

        const nav = document.querySelector(config.nav);
        gsap.killTweensOf(group);
        gsap.killTweensOf(nav);
        gsap.to(nav, { opacity: 0, duration: 0.5 });
        nav.style.pointerEvents = "none";

        gsap.delayedCall(RESPAWN_DELAY, () => respawnPiece(group, key));
    }

    pieceHits.forEach((hit) => {
        hit.addEventListener("click", (e) => {
            if (!isOpen) return;
            e.stopPropagation();
            const href = hit.dataset.href;
            if (href === "#") {
                breakPiece(hit.parentNode);
            } else if (href) {
                window.location.href = href;
            }
        });
    });

    // The label is the one reliably hoverable/clickable surface once open
    // (see the .piece-unit comment in landing.css for why the SVG piece
    // itself isn't, in WebKit) — so drive the piece's hover-red feedback
    // from the label's own hover instead of leaning on the SVG for it too.
    navItems.forEach((nav) => {
        const piece = piecePath(nav.dataset.fragment);
        nav.addEventListener("mouseenter", () => piece.classList.add("is-hovered"));
        nav.addEventListener("mouseleave", () => piece.classList.remove("is-hovered"));
    });

    navItems.forEach((nav) => {
        if (nav.getAttribute("href") !== "#") return;
        nav.addEventListener("click", (e) => {
            e.preventDefault();
            const piece = document.querySelector(fragmentMap[nav.dataset.fragment].piece);
            breakPiece(piece);
        });
    });

    logoSvg.addEventListener("click", () => {
        if (!isOpen) openLanding();
    });

    let resizeTimeout;
    let lastResizeWidth = window.innerWidth;
    let lastResizeHeight = window.innerHeight;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Some browsers fire "resize" just from moving the window (e.g.
            // dragging it across displays with a different pixel density),
            // with the actual CSS size unchanged. repositionOpen() resets
            // pieces to rest and re-measures + re-animates everything from
            // scratch, so running it on those too just replayed the same
            // (never perfectly stable) settle each time — visible as the
            // labels drifting a little further off with every drag-triggered
            // firing. Only actually run it when the size really changed.
            // A pure window move can still report the size as off by a
            // stray pixel or two (subpixel/DPI rounding while it's in
            // motion) — exact equality let that slip through and re-trigger
            // anyway, so this needs a small tolerance instead.
            const width = window.innerWidth;
            const height = window.innerHeight;
            if (Math.abs(width - lastResizeWidth) < 4 && Math.abs(height - lastResizeHeight) < 4) return;
            lastResizeWidth = width;
            lastResizeHeight = height;
            repositionOpen();
        }, 150);
    });

    window.addEventListener("load", () => {
        setInitialState();
        if (new URLSearchParams(window.location.search).get("open") === "1") {
            openLandingInstant();
        }
    });

    // Positions are measured off the hero text's rendered size, but web
    // fonts (Newsreader in particular) can still be downloading at that
    // point — the text sits in a narrower fallback font first, then
    // reflows wider/taller once the real font arrives, without anything
    // re-running the layout math. Correct for it once fonts actually settle.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (isOpen) repositionOpen();
        });
    }
})();
