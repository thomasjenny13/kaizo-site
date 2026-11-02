(function () {
    // Logo T motion (projets/logo-t.html): the cross opens like a book from
    // its vertical axis, the T strokes draw on, the right-hand t fills in
    // place, then the cross folds back and only the t (= logo.svg) remains.
    var svg = document.querySelector(".logo-motion");
    if (!svg) return;

    var D = 7000;
    var spine = svg.querySelector(".lm-spine");
    var halves = svg.querySelectorAll(".lm-half");
    var draws = svg.querySelectorAll(".lm-draw");
    var tee = svg.querySelector(".lm-tee");

    function seg(t, a, b) { return Math.min(1, Math.max(0, (t - a) / (b - a))); }
    function inOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function out(x) { return 1 - Math.pow(1 - x, 4); }

    function render(t) {
        // spine grows from the centre, the two halves unfold from it; reversed on closing
        var spineH = out(seg(t, 0, 450)) * (1 - inOut(seg(t, 3850, 4250)));
        var open = inOut(seg(t, 400, 1200)) * (1 - inOut(seg(t, 3300, 3900)));
        // a page turning on its spine: projected width follows sin(angle)
        var w = Math.sin(open * Math.PI / 2);
        spine.setAttribute("transform", "translate(0 540) scale(1 " + spineH.toFixed(4) + ") translate(0 -540)");
        spine.style.opacity = spineH > 0.001 ? 1 : 0;
        var sx = "translate(540 0) scale(" + Math.max(w, 0.0001).toFixed(4) + " 1) translate(-540 0)";
        Array.prototype.forEach.call(halves, function (h) {
            h.setAttribute("transform", sx);
            h.style.opacity = w > 0.001 ? 1 : 0;
        });

        var d = inOut(seg(t, 1200, 1900));
        Array.prototype.forEach.call(draws, function (l) {
            l.style.strokeDasharray = "1 1";
            l.style.strokeDashoffset = 1 - d;
        });

        tee.style.opacity = inOut(seg(t, 2000, 2400)) * (1 - seg(t, 6200, 6800));
    }

    // Reduced motion: hold the frame where the whole construction is visible.
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        render(2800);
        return;
    }

    var start = null;
    (function frame(now) {
        if (start === null) start = now;
        render((now - start) % D);
        requestAnimationFrame(frame);
    })(performance.now());
})();
