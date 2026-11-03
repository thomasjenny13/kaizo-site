(function () {
    // Full-screen viewer for the photo series pages: click a photo to open
    // it alone on black, then step through the series (arrows, click the
    // left/right half, swipe). Esc, the × or leaving full screen closes it.
    // On the TdM boat sheets (.project-gallery--fiches) a click on the sheet
    // zooms it to full resolution instead, so the text can be read; clicking
    // the black margins still steps.
    var photos = Array.prototype.slice.call(document.querySelectorAll(".photo-grid .project-photo, .project-gallery--fiches .project-photo"));
    if (!photos.length) return;
    var zoomable = !!document.querySelector(".project-gallery--fiches");

    var viewer = document.createElement("div");
    viewer.className = "viewer";
    viewer.hidden = true;
    viewer.innerHTML =
        '<img class="viewer-img" alt="">' +
        '<p class="viewer-count"></p>' +
        '<button class="viewer-close" type="button" aria-label="Fermer">×</button>';
    document.body.appendChild(viewer);

    var img = viewer.querySelector(".viewer-img");
    var count = viewer.querySelector(".viewer-count");
    var index = 0;
    var zoomed = false;
    if (zoomable) viewer.classList.add("viewer--zoomable");

    // Zoomed: the sheet at its natural size in a scrollable viewer. The
    // mouse pans by pointing (the sheet follows the cursor); touch and
    // trackpads just scroll.
    function setZoom(on, e) {
        zoomed = on;
        viewer.classList.toggle("is-zoomed", on);
        if (!on) return;
        var r = img.getBoundingClientRect();
        var fx = e ? (e.clientX - r.left) / r.width : 0.5;
        var fy = e ? (e.clientY - r.top) / r.height : 0.5;
        viewer.scrollLeft = fx * viewer.scrollWidth - viewer.clientWidth / 2;
        viewer.scrollTop = fy * viewer.scrollHeight - viewer.clientHeight / 2;
    }

    viewer.addEventListener("mousemove", function (e) {
        if (!zoomed) return;
        viewer.scrollLeft = (e.clientX / viewer.clientWidth) * (viewer.scrollWidth - viewer.clientWidth);
        viewer.scrollTop = (e.clientY / viewer.clientHeight) * (viewer.scrollHeight - viewer.clientHeight);
    });

    // Largest file from the photo's srcset — the grid only loads the small one.
    function fullSrc(photo) {
        var candidates = (photo.getAttribute("srcset") || "").split(",");
        var last = candidates[candidates.length - 1].trim().split(/\s+/)[0];
        return last || photo.src;
    }

    function show(i) {
        index = (i + photos.length) % photos.length;
        if (zoomed) setZoom(false);
        img.src = fullSrc(photos[index]);
        count.textContent = (index + 1) + " / " + photos.length;
        // warm up the neighbours so stepping through feels instant
        [index + 1, index - 1].forEach(function (n) {
            new Image().src = fullSrc(photos[(n + photos.length) % photos.length]);
        });
    }

    function open(i) {
        show(i);
        viewer.hidden = false;
        document.documentElement.classList.add("viewer-open");
        if (viewer.requestFullscreen) viewer.requestFullscreen().catch(function () {});
    }

    function close() {
        if (zoomed) setZoom(false);
        viewer.hidden = true;
        document.documentElement.classList.remove("viewer-open");
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        photos[index].scrollIntoView({ block: "center" });
    }

    photos.forEach(function (photo, i) {
        photo.addEventListener("click", function () {
            open(i);
        });
    });

    viewer.querySelector(".viewer-close").addEventListener("click", function (e) {
        e.stopPropagation();
        close();
    });

    viewer.addEventListener("click", function (e) {
        if (zoomable && (zoomed || e.target === img)) {
            setZoom(!zoomed, e);
            return;
        }
        show(e.clientX < window.innerWidth / 2 ? index - 1 : index + 1);
    });

    document.addEventListener("keydown", function (e) {
        if (viewer.hidden) return;
        if (e.key === "Escape") { if (zoomed) setZoom(false); else close(); }
        else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(index + 1); }
        else if (e.key === "ArrowLeft") show(index - 1);
    });

    // Esc in real full screen exits it before our keydown sees anything.
    document.addEventListener("fullscreenchange", function () {
        if (!document.fullscreenElement && !viewer.hidden) close();
    });

    var touchX = null;
    viewer.addEventListener("touchstart", function (e) {
        if (zoomed) return; // a zoomed sheet scrolls; swiping must not step
        touchX = e.touches[0].clientX;
    }, { passive: true });
    viewer.addEventListener("touchend", function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 40) {
            e.preventDefault(); // swallow the click that would also step
            show(dx < 0 ? index + 1 : index - 1);
        }
    });
})();
