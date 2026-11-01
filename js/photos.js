(function () {
    // Full-screen viewer for the photo series pages: click a photo to open
    // it alone on black, then step through the series (arrows, click the
    // left/right half, swipe). Esc, the × or leaving full screen closes it.
    var photos = Array.prototype.slice.call(document.querySelectorAll(".photo-grid .project-photo"));
    if (!photos.length) return;

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

    // Largest file from the photo's srcset — the grid only loads the small one.
    function fullSrc(photo) {
        var candidates = (photo.getAttribute("srcset") || "").split(",");
        var last = candidates[candidates.length - 1].trim().split(/\s+/)[0];
        return last || photo.src;
    }

    function show(i) {
        index = (i + photos.length) % photos.length;
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
        show(e.clientX < window.innerWidth / 2 ? index - 1 : index + 1);
    });

    document.addEventListener("keydown", function (e) {
        if (viewer.hidden) return;
        if (e.key === "Escape") close();
        else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(index + 1); }
        else if (e.key === "ArrowLeft") show(index - 1);
    });

    // Esc in real full screen exits it before our keydown sees anything.
    document.addEventListener("fullscreenchange", function () {
        if (!document.fullscreenElement && !viewer.hidden) close();
    });

    var touchX = null;
    viewer.addEventListener("touchstart", function (e) {
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
