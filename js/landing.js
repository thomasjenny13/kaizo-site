(function () {
    const landing = document.getElementById("landing");
    const logoSvg = document.getElementById("landing-logo");
    const logoGroup = document.getElementById("logo");
    const piecesGroup = document.getElementById("pieces");
    const pieces = document.querySelectorAll(".piece");
    const navItems = document.querySelectorAll(".nav-item");
    const hero = document.querySelector(".hero");
    const brandMark = document.querySelector(".brand-mark");

    const fragmentMap = {
        top: { piece: "#piece-top", nav: ".nav-top" },
        left: { piece: "#piece-left", nav: ".nav-left" },
        right: { piece: "#piece-right", nav: ".nav-right" },
        bottom: { piece: "#piece-bottom", nav: ".nav-bottom" }
    };

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
    function getPieceRestOffsets() {
        const centerRect = landing.getBoundingClientRect();
        const centerX = centerRect.left + centerRect.width / 2;
        const centerY = centerRect.top + centerRect.height / 2;
        const offsets = {};
        Object.entries(fragmentMap).forEach(([key, config]) => {
            const rect = document.querySelector(config.piece).getBoundingClientRect();
            offsets[key] = {
                x: (rect.left + rect.right) / 2 - centerX,
                y: (rect.top + rect.bottom) / 2 - centerY,
                width: rect.width,
                height: rect.height
            };
        });
        return offsets;
    }

    const PIECE_HIT_STROKE = 50; // must match .piece { stroke-width } in landing.css

    // getBoundingClientRect() on a piece includes the invisible stroke added
    // for a bigger mobile touch target — for the HUD (tracking box + connector
    // line) that inflated rect reads wrong, so this insets it back out to the
    // piece's actual visible silhouette.
    function pieceVisualRect(piece) {
        const rect = piece.getBoundingClientRect();
        const inset = (PIECE_HIT_STROKE / getSvgScaleFactor()) * gsap.getProperty(piece, "scale");
        return {
            left: rect.left + inset,
            top: rect.top + inset,
            right: rect.right - inset,
            bottom: rect.bottom - inset,
            width: Math.max(0, rect.width - inset * 2),
            height: Math.max(0, rect.height - inset * 2)
        };
    }

    // Converts a desired on-screen offset (real px, from the logo's center)
    // into the gsap x/y that actually produces it for this piece.
    function pieceOffset(key, desiredX, desiredY, restOffsets, k) {
        return {
            x: (desiredX - restOffsets[key].x) * k,
            y: (desiredY - restOffsets[key].y) * k
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
            top: { ...pieceOffset("top", -colOffset, -rowOffset, restOffsets, k), rotation: -6, scale: pieceScale },
            right: { ...pieceOffset("right", colOffset, -rowOffset, restOffsets, k), rotation: 8, scale: pieceScale },
            left: { ...pieceOffset("left", -colOffset, rowOffset, restOffsets, k), rotation: -8, scale: pieceScale },
            bottom: { ...pieceOffset("bottom", colOffset, rowOffset, restOffsets, k), rotation: 6, scale: pieceScale }
        };

        // The label rides on the piece itself — same raw on-screen offset
        // used to place the piece (plus a small fixed downward nudge so it
        // reads as a caption just below it rather than stamped dead-center)
        // — never a separate perpendicular-offset formula to fall out of
        // sync, or go off-screen on its own, on a resize.
        const labelNudgeY = 12 * pieceScale;
        const labels = {
            top: { x: -colOffset, y: -rowOffset + labelNudgeY },
            right: { x: colOffset, y: -rowOffset + labelNudgeY },
            left: { x: -colOffset, y: rowOffset + labelNudgeY },
            bottom: { x: colOffset, y: rowOffset + labelNudgeY }
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
        const pieceScale = Math.min(1.55, Math.max(0.65, Math.min(vw / 480, vh / 420)));

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
        // à propos kept landing on the definition text despite the hero-
        // clearance math above, so it gets the same treatment as the other
        // three plus a flat extra push down — simple and predictable rather
        // than relying on a predicted/measured clearance value.
        const marginYBottom = Math.min(marginY + 200, edgeCapY);

        // Pieces are transformed inside the SVG's own coordinate space, so
        // their targets need the scale-factor correction to land at the
        // same visual distance as marginX/marginY.
        const pieces = {
            top: { ...pieceOffset("top", 0, -marginY, restOffsets, k), rotation: -6, scale: pieceScale },
            bottom: { ...pieceOffset("bottom", 0, marginYBottom, restOffsets, k), rotation: 6, scale: pieceScale },
            left: { ...pieceOffset("left", -marginX, 0, restOffsets, k), rotation: -14, scale: pieceScale },
            right: { ...pieceOffset("right", marginX, 0, restOffsets, k), rotation: 14, scale: pieceScale }
        };

        // The label rides directly on its piece — same raw on-screen offset
        // used to place the piece, plus a small fixed downward nudge so it
        // reads as a caption just below it rather than stamped dead-center
        // — so it's never somewhere the piece isn't. (The old version placed
        // labels at their own perpendicular offset out from the piece, which
        // needed its own set of edge caps and kept breaking on resize — this
        // can't, since it has no formula of its own left to get wrong.)
        const labelNudgeY = 12 * pieceScale;
        const labels = {
            top: { x: 0, y: -marginY + labelNudgeY },
            bottom: { x: 0, y: marginYBottom + labelNudgeY },
            left: { x: -marginX, y: labelNudgeY },
            right: { x: marginX, y: labelNudgeY }
        };

        return { pieces, labels };
    }

    function setInitialState() {
        gsap.set(landing, { backgroundColor: "#000" });
        gsap.set("body", { backgroundColor: "#000" });
        gsap.set(logoSvg, { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" });
        gsap.set(logoGroup, { opacity: 1 });
        gsap.set(piecesGroup, { opacity: 0 });
        gsap.set(pieces, { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: "50% 50%" });
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
            const piece = document.querySelector(config.piece);
            const nav = document.querySelector(config.nav);
            const box = pieceVisualRect(piece);

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
            gsap.killTweensOf(piece);
            gsap.killTweensOf(nav);
            gsap.to(piece, { x: `+=${dx}`, y: `+=${dy}`, duration: 0.4, ease: "power2.out" });
            gsap.to(nav, { x: `+=${dx}`, y: `+=${dy}`, duration: 0.4, ease: "power2.out" });
            gsap.delayedCall(0.4, () => floatPiece(key));
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

        const { pieces: pieceTargets, labels: labelTargets } = getTargets();
        const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });

        tl.to(landing, { backgroundColor: "#fff", duration: 0.8 }, 0)
            .to("body", { backgroundColor: "#fff", duration: 0.8 }, 0)
            .to(logoSvg, { scale: 1.06, duration: 0.9, ease: "power3.out" }, 0.05)
            .to(piecesGroup, { opacity: 1, duration: 0.15 }, 0.45)
            .to(logoGroup, { opacity: 0, duration: 0.3 }, 0.48)
            .add(() => landing.classList.add("is-open"), 0.5);

        Object.entries(pieceTargets).forEach(([key, target]) => {
            tl.to(`#piece-${key}`, {
                x: target.x,
                y: target.y,
                rotation: target.rotation,
                scale: target.scale,
                duration: 2.1,
                ease: "expo.out",
                // starting the idle float before this tween lands would
                // fight it for the same x/y properties (see floatPiece)
                onComplete: () => floatPiece(key)
            }, 0.55);
        });

        Object.entries(labelTargets).forEach(([key, target]) => {
            tl.to(fragmentMap[key].nav, {
                x: target.x,
                y: target.y,
                duration: 2.1,
                ease: "expo.out"
            }, 0.55);
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
            const { pieces: pieceTargets, labels: labelTargets } = getTargets();

            Object.entries(pieceTargets).forEach(([key, target]) => {
                gsap.set(`#piece-${key}`, {
                    x: target.x,
                    y: target.y,
                    rotation: target.rotation,
                    scale: target.scale
                });
            });

            Object.entries(labelTargets).forEach(([key, target]) => {
                gsap.set(fragmentMap[key].nav, { x: target.x, y: target.y });
            });

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

        gsap.killTweensOf(pieces);
        gsap.killTweensOf(navItems);

        // getPieceRestOffsets() (called inside getTargets()) only measures
        // correctly while pieces sit untransformed at their rest position —
        // but by the time a resize/rotation calls repositionOpen(), they're
        // already spread out from the last layout. Without resetting them
        // first, it measures the wrong reference point and every position
        // comes out wrong, compounding further on each subsequent resize.
        gsap.set(pieces, { x: 0, y: 0, rotation: 0, scale: 1 });

        const { pieces: pieceTargets, labels: labelTargets } = getTargets();

        Object.entries(pieceTargets).forEach(([key, target]) => {
            gsap.to(fragmentMap[key].piece, {
                x: target.x,
                y: target.y,
                rotation: target.rotation,
                scale: target.scale,
                duration: 0.5,
                ease: "power2.out"
            });
        });

        Object.entries(labelTargets).forEach(([key, target]) => {
            gsap.to(fragmentMap[key].nav, {
                x: target.x,
                y: target.y,
                duration: 0.5,
                ease: "power2.out"
            });
        });

        // Restarting float per-piece as each one's own tween completed used
        // to race the label's separate move tween landing at roughly the
        // same time — floatPiece() touches both, so whichever finished
        // first could get overwritten mid-flight by the other, leaving it
        // adrift from a stale not-quite-final position. One clean restart
        // once BOTH have actually settled avoids that.
        gsap.delayedCall(0.5, startFloating);
        gsap.delayedCall(0.55, scheduleHeroOverlapChecks);
    }

    const SVG_NS = "http://www.w3.org/2000/svg";

    // Splits the piece into an irregular fan of triangular shards radiating
    // from its center — like cracked glass — that burst outward, spin and
    // fade, plus a quick flash at the point of impact.
    function shatterPiece(piece) {
        const bbox = piece.getBBox();
        const d = piece.getAttribute("d");
        const fill = getComputedStyle(piece).fill;
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

            const clipId = `shard-clip-${piece.id}-${i}`;
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

        // getBBox() ignores the piece's current GSAP transform (it's the
        // untransformed local geometry), so without this the shards would
        // render back at the piece's rest position instead of wherever it
        // actually is on screen right now.
        piece.parentNode.insertBefore(shardGroup, piece.nextSibling);
        shardGroup.style.transformBox = "view-box";
        gsap.set(shardGroup, {
            transformOrigin: `${pieceCx}px ${pieceCy}px`,
            x: gsap.getProperty(piece, "x"),
            y: gsap.getProperty(piece, "y"),
            rotation: gsap.getProperty(piece, "rotation"),
            scale: gsap.getProperty(piece, "scale")
        });

        gsap.set(piece, { opacity: 0 });
        piece.style.pointerEvents = "none";

        gsap.delayedCall(1.1, () => shardGroup.remove());
    }

    const RESPAWN_DELAY = 4.5;

    function respawnPiece(piece, key) {
        delete piece.dataset.broken;
        piece.style.pointerEvents = "";
        gsap.to(piece, { opacity: 1, duration: 0.6, ease: "power2.out" });

        const nav = document.querySelector(fragmentMap[key].nav);
        nav.style.pointerEvents = "";
        gsap.to(nav, { opacity: 1, duration: 0.6, ease: "power2.out" });

        const trackingBox = document.querySelector(`.tracking-box[data-fragment="${key}"]`);
        const connectorLine = document.querySelector(`.connector[data-fragment="${key}"]`);
        gsap.to(trackingBox, { opacity: 0.35, duration: 0.6, ease: "power2.out" });
        gsap.to(connectorLine, { opacity: 0.45, duration: 0.6, ease: "power2.out" });

        floatPiece(key);
    }

    function breakPiece(piece) {
        if (piece.dataset.broken) return;
        piece.dataset.broken = "true";

        shatterPiece(piece);

        const key = piece.dataset.fragment;
        const config = fragmentMap[key];
        if (!config) return;

        const nav = document.querySelector(config.nav);
        gsap.killTweensOf(piece);
        gsap.killTweensOf(nav);
        gsap.to(nav, { opacity: 0, duration: 0.5 });
        nav.style.pointerEvents = "none";

        const trackingBox = document.querySelector(`.tracking-box[data-fragment="${key}"]`);
        const connectorLine = document.querySelector(`.connector[data-fragment="${key}"]`);
        gsap.to([trackingBox, connectorLine], { opacity: 0, duration: 0.5 });

        gsap.delayedCall(RESPAWN_DELAY, () => respawnPiece(piece, key));
    }

    pieces.forEach((piece) => {
        piece.addEventListener("click", (e) => {
            if (!isOpen) return;
            e.stopPropagation();
            const href = piece.dataset.href;
            if (href === "#") {
                breakPiece(piece);
            } else if (href) {
                window.location.href = href;
            }
        });
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
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        // repositionOpen() resets pieces to rest before remeasuring, so it's
        // safe to just re-run it on every resize (including the spurious
        // ones mobile Safari fires when its URL bar collapses/expands) —
        // a desktop window resized in height alone still needs this too.
        resizeTimeout = setTimeout(repositionOpen, 150);
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
