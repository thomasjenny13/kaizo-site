// Portfolio lightbox: any page image opens full screen in its HD version.
// Click toggles between fit-to-screen and full resolution (scrolled so the
// clicked spot stays under the cursor); arrows / swipe / ← → step through
// the pages currently shown (spreads on desktop, single pages on phones).

(function () {
    const box = document.querySelector('.lightbox');
    const stage = box.querySelector('.lightbox-stage');
    const big = box.querySelector('.lightbox-img');
    const all = Array.from(document.querySelectorAll('.folio-img'));
    let list = [];
    let index = 0;

    function show(i) {
        index = (i + list.length) % list.length;
        const img = list[index];
        box.classList.remove('is-zoomed');
        big.src = img.currentSrc || img.src; // already-loaded size first, swapped for HD once it has loaded
        big.alt = img.alt;
        const hd = new Image();
        hd.onload = () => { if (list[index] === img) big.src = hd.src; };
        hd.src = img.dataset.hd;
    }

    function open(img) {
        list = all.filter((el) => el.offsetParent !== null);
        box.hidden = false;
        document.body.style.overflow = 'hidden';
        show(list.indexOf(img));
    }

    function close() {
        box.hidden = true;
        document.body.style.overflow = '';
        big.removeAttribute('src');
    }

    function toggleZoom(e) {
        if (box.classList.contains('is-zoomed')) {
            box.classList.remove('is-zoomed');
            return;
        }
        const r = big.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        const fy = (e.clientY - r.top) / r.height;
        box.classList.add('is-zoomed');
        // At least 2× the fitted size, more if the HD file allows it
        const w = Math.max(r.width * 2, Math.min(big.naturalWidth, r.width * 3));
        big.style.width = w + 'px';
        stage.scrollLeft = fx * big.offsetWidth - e.clientX;
        stage.scrollTop = fy * big.offsetHeight - e.clientY;
    }

    all.forEach((img) => img.addEventListener('click', () => open(img)));
    big.addEventListener('click', toggleZoom);
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });
    box.querySelector('.lightbox-close').addEventListener('click', close);
    box.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
    box.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));

    // Fitted size is set by CSS; drop the inline width when leaving zoom
    new MutationObserver(() => {
        if (!box.classList.contains('is-zoomed')) big.style.width = '';
    }).observe(box, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('keydown', (e) => {
        if (box.hidden) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') show(index - 1);
        else if (e.key === 'ArrowRight') show(index + 1);
    });

    let startX = null;
    stage.addEventListener('touchstart', (e) => {
        startX = e.touches.length === 1 && !box.classList.contains('is-zoomed') ? e.touches[0].clientX : null;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
        startX = null;
    });
})();
