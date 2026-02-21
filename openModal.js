function openModal(imgObj){
    modal.style.display = 'flex';
    const meta = document.getElementById('meta-desc').parentElement.parentElement.querySelector('.meta') || document.querySelector('#modal .meta');
    if (meta) { meta.style.maxHeight = ''; meta.style.overflow = ''; }

    modalImg.style.maxHeight = Math.round(window.innerHeight * 0.7) + 'px';
    modalImg.src = 'immagini_insta_siamoalpi/' + imgObj.filename;
    const m = imgObj.meta || {};
    metaYear.textContent = m.year || '';
    metaDesc.textContent = m.Description || m.description || '';
    metaCat.textContent = m.category || '';
    metaTags.textContent = m.tags || '';
    modal.setAttribute('aria-hidden','false');

    const card = modal.querySelector('.card');
    const adjustToFit = () => {
        const maxCard = Math.round(window.innerHeight * 0.9);
        let imgMax = Math.min(Math.round(window.innerHeight * 0.7), modalImg.naturalHeight || Math.round(window.innerHeight * 0.7));
        modalImg.style.maxHeight = imgMax + 'px';
        let iter = 0;
        while (card.getBoundingClientRect().height > maxCard && iter < 40) {
            imgMax = Math.max(80, imgMax - 40);
            modalImg.style.maxHeight = imgMax + 'px';
            iter++;
        }
        if (card.getBoundingClientRect().height > maxCard) {
            const metaCont = card.querySelector('.meta');
            const avail = Math.max(60, maxCard - (card.querySelector('.img-wrap').getBoundingClientRect().height) - 40);
            metaCont.style.maxHeight = avail + 'px';
            metaCont.style.overflow = 'auto';
        }
    };

    modalImg.onload = () => { adjustToFit(); };
    if (modalImg.complete) adjustToFit();
}
