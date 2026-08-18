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

    function getTargets() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const k = getSvgScaleFactor();

        // Visual (on-screen px) positions — used for the label math below.
        // The buffer keeps the piece's own footprint (scaled ~1.55x) plus
        // its label clear of the viewport edge — this is a hard ceiling,
        // pieces must never be pushed past it or they clip off-screen.
        const buffer = 170;
        const edgeCapX = vw / 2 - buffer;
        const edgeCapY = vh / 2 - buffer;

        // Within that ceiling, try to also clear the hero text block so the
        // right/bottom piece + label don't land on top of it on narrower
        // viewports.
        const heroRect = hero.getBoundingClientRect();
        const heroClearanceX = heroRect.width / 2 + 40;
        const heroClearanceY = heroRect.height / 2 + 40;

        const marginX = Math.min(Math.max(vw * 0.28, heroClearanceX), 460, edgeCapX);
        const marginY = Math.min(Math.max(vh * 0.26, heroClearanceY), 360, edgeCapY);

        const labelOffset = Math.min(Math.max(vw * 0.07, 100), 160);

        // Pieces are transformed inside the SVG's own coordinate space, so
        // their targets need the scale-factor correction to land at the
        // same visual distance as marginX/marginY.
        const pieces = {
            top: { x: 0, y: -marginY * k, rotation: -6, scale: 1.55 },
            bottom: { x: 0, y: marginY * k, rotation: 6, scale: 1.55 },
            left: { x: -marginX * k, y: 0, rotation: -14, scale: 1.55 },
            right: { x: marginX * k, y: 0, rotation: 14, scale: 1.55 }
        };

        // Labels are plain HTML, positioned in real px — 90° clockwise from
        // the piece's own outward direction.
        const labels = {
            top: { x: labelOffset * 1.7, y: -marginY },
            right: { x: marginX, y: labelOffset },
            bottom: { x: -labelOffset * 1.5, y: marginY },
            left: { x: -marginX, y: -labelOffset * 1.5 }
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
        gsap.set(hero, { opacity: 0, y: 16 });
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

            const box = trackingRect(piece.getBoundingClientRect());
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
            const { left, top, right, bottom } = trackingRect(piece.getBoundingClientRect());

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

    function startFloating() {
        const k = getSvgScaleFactor();
        // x, y and rotation each run on their own out-of-sync period, so the
        // combined path drifts like a Lissajous curve instead of oscillating
        // back and forth along one straight in/out line.
        const floats = [
            { key: "top", x: 10, y: -14, rot: -4, durX: 6.4, durY: 5.1, durR: 7.3 },
            { key: "left", x: -16, y: 10, rot: -6, durX: 5.5, durY: 6.7, durR: 6.0 },
            { key: "right", x: 16, y: 10, rot: 6, durX: 6.9, durY: 5.6, durR: 6.5 },
            { key: "bottom", x: -10, y: 14, rot: 4, durX: 5.8, durY: 7.1, durR: 5.4 }
        ];

        floats.forEach(({ key, x, y, rot, durX, durY, durR }) => {
            const piece = fragmentMap[key].piece;
            const nav = fragmentMap[key].nav;
            const tweenOpts = { repeat: -1, yoyo: true, ease: "sine.inOut" };

            gsap.to(piece, { x: `+=${x * k}`, duration: durX, ...tweenOpts });
            gsap.to(piece, { y: `+=${y * k}`, duration: durY, ...tweenOpts });
            gsap.to(piece, { rotation: `+=${rot}`, duration: durR, ...tweenOpts });

            // the label rides along with its piece so it reads as one unit
            gsap.to(nav, { x: `+=${x}`, duration: durX, ...tweenOpts });
            gsap.to(nav, { y: `+=${y}`, duration: durY, ...tweenOpts });
        });
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
                ease: "expo.out"
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
            .call(startFloating, null, 2.0);
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
    }

    pieces.forEach((piece) => {
        piece.addEventListener("click", (e) => {
            if (!isOpen) return;
            e.stopPropagation();
            const href = piece.dataset.href;
            if (href && href !== "#") {
                window.location.href = href;
            }
        });
    });

    logoSvg.addEventListener("click", () => {
        if (!isOpen) openLanding();
    });

    window.addEventListener("resize", () => {
        if (connectorsActive) updateOverlay();
    });

    window.addEventListener("load", () => {
        setInitialState();
        if (new URLSearchParams(window.location.search).get("open") === "1") {
            openLandingInstant();
        }
    });
})();
