(function () {
    const landing = document.getElementById("landing");
    const logoSvg = document.getElementById("landing-logo");
    const logoGroup = document.getElementById("logo");
    const piecesGroup = document.getElementById("pieces");
    const pieces = document.querySelectorAll(".piece");
    const navItems = document.querySelectorAll(".nav-item");
    const connectors = document.querySelector(".connectors");
    const connectorLines = document.querySelectorAll(".connector");
    const trackingBoxes = document.querySelectorAll(".tracking-box");
    const hero = document.querySelector(".hero");
    const brandMark = document.querySelector(".brand-mark");

    const TRACKING_PADDING = 16;
    const LABEL_GAP = 10;

    function trackingRect(pieceRect) {
        return {
            left: pieceRect.left - TRACKING_PADDING,
            top: pieceRect.top - TRACKING_PADDING,
            right: pieceRect.right + TRACKING_PADDING,
            bottom: pieceRect.bottom + TRACKING_PADDING
        };
    }

    // Point where the segment from the rect's center toward (targetX, targetY)
    // crosses the rect's boundary.
    function rectEdgePoint(rect, targetX, targetY) {
        const cx = (rect.left + rect.right) / 2;
        const cy = (rect.top + rect.bottom) / 2;
        const halfW = (rect.right - rect.left) / 2;
        const halfH = (rect.bottom - rect.top) / 2;
        const dx = targetX - cx;
        const dy = targetY - cy;
        if (dx === 0 && dy === 0) return { x: cx, y: cy };
        const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
        const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
        const t = Math.min(tx, ty);
        return { x: cx + dx * t, y: cy + dy * t };
    }

    const fragmentMap = {
        top: { piece: "#piece-top", nav: ".nav-top" },
        left: { piece: "#piece-left", nav: ".nav-left" },
        right: { piece: "#piece-right", nav: ".nav-right" },
        bottom: { piece: "#piece-bottom", nav: ".nav-bottom" }
    };

    let isOpen = false;
    let connectorsActive = false;

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
        const labelGap = 68;

        const pieces = {
            top: { ...pieceOffset("top", -colOffset, -rowOffset, restOffsets, k), rotation: -6, scale: pieceScale },
            right: { ...pieceOffset("right", colOffset, -rowOffset, restOffsets, k), rotation: 8, scale: pieceScale },
            left: { ...pieceOffset("left", -colOffset, rowOffset, restOffsets, k), rotation: -8, scale: pieceScale },
            bottom: { ...pieceOffset("bottom", colOffset, rowOffset, restOffsets, k), rotation: 6, scale: pieceScale }
        };

        const labels = {
            top: { x: -colOffset, y: -rowOffset + labelGap },
            right: { x: colOffset, y: -rowOffset + labelGap },
            left: { x: -colOffset, y: rowOffset - labelGap },
            bottom: { x: colOffset, y: rowOffset - labelGap }
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
        // scale down with viewport width instead of staying fixed desktop
        // values.
        const pieceScale = Math.min(1.55, Math.max(1.05, vw / 480));

        // Visual (on-screen px) positions — used for the label math below.
        // The buffer keeps the piece's own footprint (scaled by pieceScale)
        // plus its label clear of the viewport edge — this is a hard
        // ceiling, pieces must never be pushed past it or they clip off-screen.
        const buffer = Math.min(170, Math.max(60, vw * 0.13));
        const edgeCapX = vw / 2 - buffer;
        const edgeCapY = vh / 2 - buffer;

        // Within that ceiling, try to also clear the hero text block so the
        // right/bottom piece + label don't land on top of it on narrower
        // viewports. The clearance has to account for the piece's own
        // footprint too — marginX/Y position its center, but its edge (plus
        // the tracking-box padding) reaches further toward the hero than
        // that center point.
        const heroRect = hero.getBoundingClientRect();
        const gap = 40;
        const pieceHalfW = Math.max(restOffsets.left.width, restOffsets.right.width) / 2 * pieceScale;
        const pieceHalfH = Math.max(restOffsets.top.height, restOffsets.bottom.height) / 2 * pieceScale;
        const heroClearanceX = heroRect.width / 2 + gap + pieceHalfW + TRACKING_PADDING;
        const heroClearanceY = heroRect.height / 2 + gap + pieceHalfH + TRACKING_PADDING;

        const marginX = Math.min(Math.max(vw * 0.28, heroClearanceX), 460, edgeCapX);
        const marginY = Math.min(Math.max(vh * 0.26, heroClearanceY), 360, edgeCapY);
        // à propos kept landing on the definition text despite the hero-
        // clearance math above, so it gets the same treatment as the other
        // three plus a flat extra push down — simple and predictable rather
        // than relying on a predicted/measured clearance value.
        const marginYBottom = Math.min(marginY + 200, edgeCapY);

        // Same perpendicular offset for every label, so the four read as one
        // consistent system instead of four separately-tuned distances.
        const labelOffset = Math.min(Math.max(vw * 0.1, 110), 220);

        // Pieces are transformed inside the SVG's own coordinate space, so
        // their targets need the scale-factor correction to land at the
        // same visual distance as marginX/marginY.
        const pieces = {
            top: { ...pieceOffset("top", 0, -marginY, restOffsets, k), rotation: -6, scale: pieceScale },
            bottom: { ...pieceOffset("bottom", 0, marginYBottom, restOffsets, k), rotation: 6, scale: pieceScale },
            left: { ...pieceOffset("left", -marginX, 0, restOffsets, k), rotation: -14, scale: pieceScale },
            right: { ...pieceOffset("right", marginX, 0, restOffsets, k), rotation: 14, scale: pieceScale }
        };

        // Labels are plain HTML, positioned in real px — 90° clockwise from
        // the piece's own outward direction. Same flat-extra treatment as
        // "à propos" below: "fragile" is a tall sliver that the predicted
        // offset kept undershooting, so it gets a fixed, generous add-on
        // instead of a computed one.
        const labels = {
            top: { x: labelOffset, y: -marginY },
            right: { x: marginX, y: labelOffset },
            bottom: { x: -(labelOffset + 50), y: marginYBottom },
            left: { x: -marginX, y: -(labelOffset + 50) }
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
        gsap.set(connectors, { opacity: 0 });
        landing.classList.remove("is-open");
        connectorsActive = false;
        gsap.ticker.remove(updateOverlay);
    }

    function updateConnectors() {
        if (!connectorsActive) return;

        connectorLines.forEach((line) => {
            const key = line.dataset.fragment;
            const config = fragmentMap[key];
            const piece = document.querySelector(config.piece);
            const nav = document.querySelector(config.nav);
            const label = nav.querySelector(".nav-label");

            const box = trackingRect(pieceVisualRect(piece));
            const labelRect = label.getBoundingClientRect();
            const labelBox = {
                left: labelRect.left - LABEL_GAP,
                top: labelRect.top - LABEL_GAP,
                right: labelRect.right + LABEL_GAP,
                bottom: labelRect.bottom + LABEL_GAP
            };

            const pieceCx = (box.left + box.right) / 2;
            const pieceCy = (box.top + box.bottom) / 2;
            const { x: x1, y: y1 } = rectEdgePoint(labelBox, pieceCx, pieceCy);
            const { x: x2, y: y2 } = rectEdgePoint(box, x1, y1);

            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);

            const length = Math.hypot(x2 - x1, y2 - y1);
            line.style.strokeDasharray = length;
            line.style.strokeDashoffset = "0";
        });
    }

    function updateTrackingBoxes() {
        if (!connectorsActive) return;

        trackingBoxes.forEach((box) => {
            const key = box.dataset.fragment;
            const piece = document.querySelector(fragmentMap[key].piece);
            const { left, top, right, bottom } = trackingRect(pieceVisualRect(piece));

            box.setAttribute("x", left);
            box.setAttribute("y", top);
            box.setAttribute("width", right - left);
            box.setAttribute("height", bottom - top);
        });
    }

    function updateOverlay() {
        updateConnectors();
        updateTrackingBoxes();
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
            const box = trackingRect(piece.getBoundingClientRect());

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
            // restart the float from there.
            gsap.killTweensOf(piece);
            gsap.killTweensOf(nav);
            gsap.to(piece, {
                x: `+=${dx}`,
                y: `+=${dy}`,
                duration: 0.4,
                ease: "power2.out",
                onComplete: () => floatPiece(key)
            });
            gsap.to(nav, { x: `+=${dx}`, y: `+=${dy}`, duration: 0.4, ease: "power2.out" });
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
            .to(connectors, { opacity: 1, duration: 0.8 }, 1.6)
            .call(() => {
                connectorsActive = true;
                updateOverlay();
                gsap.ticker.add(updateOverlay);
            }, null, 1.6)
            .call(scheduleHeroOverlapChecks, null, 2.7);
    }

    // Used when arriving from another page (e.g. a "retour" link) — jumps
    // straight to the open state instead of replaying the reveal animation.
    function openLandingInstant() {
        if (isOpen) return;
        isOpen = true;

        const { pieces: pieceTargets, labels: labelTargets } = getTargets();

        gsap.set(landing, { backgroundColor: "#fff" });
        gsap.set("body", { backgroundColor: "#fff" });
        gsap.set(logoSvg, { scale: 1.06 });
        gsap.set(piecesGroup, { opacity: 1 });
        gsap.set(logoGroup, { opacity: 0 });
        landing.classList.add("is-open");

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

        gsap.set(hero, { opacity: 1, y: 0 });
        gsap.set(brandMark, { opacity: 1, y: 0 });
        gsap.set(navItems, { opacity: 1 });
        gsap.set(connectors, { opacity: 1 });

        connectorsActive = true;
        updateOverlay();
        gsap.ticker.add(updateOverlay);
        startFloating();
        scheduleHeroOverlapChecks();
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
                ease: "power2.out",
                onComplete: () => floatPiece(key)
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
    let lastResizeWidth = window.innerWidth;
    window.addEventListener("resize", () => {
        if (connectorsActive) updateOverlay();
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Mobile Safari fires "resize" when its URL bar collapses/expands
            // on scroll/tap — that only changes innerHeight, not innerWidth.
            // Re-laying-out (and re-animating) pieces for that silently moves
            // them right after the user opened the view, so taps miss. A
            // real resize/orientation change always changes the width too.
            const width = window.innerWidth;
            if (width === lastResizeWidth) return;
            lastResizeWidth = width;
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
