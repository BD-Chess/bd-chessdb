(() => {
  'use strict';

  const { width, height, slides } = JSON.parse(document.getElementById('cpq-show-data').textContent);
  const assetBase = new URL('./', document.currentScript.src);
  const player = document.getElementById('cpq-show');
  const mat = document.getElementById('cpq-show-mat');
  const stage = document.getElementById('cpq-show-stage');
  const launch = document.getElementById('cpq-show-launch');
  const previous = document.getElementById('cpq-show-prev');
  const next = document.getElementById('cpq-show-next');
  const close = document.getElementById('cpq-show-close');
  const counter = document.getElementById('cpq-show-count');
  const page = document.querySelectorAll('body > .skip, body > .top, body > main, body > .footer');

  let index = -1;
  let playback = 0;
  let wasFullscreen = false;
  const percent = (value, limit) => `${value / limit * 100}%`;
  const unit = value => `${value / width * 100}cqw`;
  const activeFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement;

  function fit() {
    const availableWidth = Math.min(mat.clientWidth, mat.clientHeight * width / height);
    stage.style.setProperty('--stage-width', `${availableWidth}px`);
  }

  function place(element, { x, y, w, h }, canvasWidth = width, canvasHeight = height) {
    Object.assign(element.style, {
      left: percent(x, canvasWidth), top: percent(y, canvasHeight),
      width: percent(w, canvasWidth), height: percent(h, canvasHeight),
    });
  }

  function animate(element, keyframes, delay, duration, easing = 'linear') {
    return element.animate(keyframes, { delay, duration, easing, fill: 'both' });
  }

  function showSlide(position) {
    if (position === index || position < 0 || position >= slides.length) return;
    const version = ++playback;
    index = position;
    const slide = slides[index];
    const image = new Image();
    image.className = 'cpq-show-image';
    image.alt = '';
    image.draggable = false;
    image.style.opacity = slide.initialOpacity;
    place(image, slide.picture);

    const group = document.createElement('div');
    group.className = 'cpq-show-title-group';
    const { x, y, w, h, dx, dy, rotation, at, duration, accel, decel } = slide.heading;
    const left = x + w / 2;
    const top = y + h / 2;
    Object.assign(group.style, {
      left: percent(left, width), top: percent(top, height),
      width: percent(w, width), height: percent(h, height),
    });
    slide.heading.captions.forEach((caption, i) => {
      const text = document.createElement(i === 0 ? 'h2' : 'p');
      text.className = 'cpq-show-caption';
      text.textContent = caption.text;
      Object.assign(text.style, { color: caption.color, fontSize: unit(caption.font), fontWeight: caption.weight });
      place(text, caption, w, h);
      group.append(text);
    });

    const frames = slide.frames.map(frame => {
      const border = document.createElement('div');
      border.className = 'cpq-show-frame';
      border.setAttribute('aria-hidden', 'true');
      place(border, frame);
      border.style.border = `max(1px, ${unit(frame.lineWidth)}) solid ${frame.color}`;
      border.style.borderRadius = frame.rounded ? unit(47500) : '0';
      return border;
    });

    stage.style.setProperty('--slide-background', slide.background);
    stage.setAttribute('aria-label', `${index + 1}. diapozitiv. ${slide.heading.captions[0].text}`);
    stage.toggleAttribute('data-can-advance', index < slides.length - 1);
    stage.replaceChildren(image, group, ...frames);
    counter.textContent = `${index + 1} / ${slides.length}`;
    const focusedControl = document.activeElement;
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    if (focusedControl?.disabled) player.focus({ preventScroll: true });

    image.src = new URL(slide.picture.src, assetBase).href;
    const play = () => {
      if (version !== playback || player.hidden) return;
      animate(image, [{ opacity: slide.initialOpacity }, { opacity: 1 }], slide.picture.at, slide.picture.duration);
      const positionAt = (offset, fraction, easing = 'linear') => ({
        offset, easing,
        left: percent(left + dx * fraction, width),
        top: percent(top + dy * fraction, height),
        transform: `translate(-50%, -50%) rotate(${rotation * fraction}deg)`,
      });
      const topSpeed = 1 / (1 - (accel + decel) / 2);
      animate(group, [
        positionAt(0, 0, 'cubic-bezier(.333333, 0, .666667, .333333)'),
        positionAt(accel, accel * topSpeed / 2),
        positionAt(1 - decel, 1 - decel * topSpeed / 2, 'cubic-bezier(.333333, .666667, .666667, 1)'),
        positionAt(1, 1),
      ], at, duration);
      frames.forEach((border, i) => {
        const frame = slide.frames[i];
        animate(border, [{ opacity: 0 }, { opacity: 1 }], frame.at, frame.duration);
      });
    };
    if (image.decode) image.decode().then(play, play);
    else play();
  }

  function openShow() {
    if (!player.hidden) return;
    player.hidden = false;
    document.documentElement.classList.add('cpq-showing');
    page.forEach(element => { element.inert = true; });
    fit();
    player.focus({ preventScroll: true });
    const request = player.requestFullscreen || player.webkitRequestFullscreen;
    if (request) {
      try { Promise.resolve(request.call(player)).catch(() => {}); }
      catch (_) { /* The full-window view is already open. */ }
    }
    showSlide(0);
  }

  function closeShow() {
    if (player.hidden) return;
    const wasOpen = activeFullscreen() === player;
    wasFullscreen = false;
    player.hidden = true;
    index = -1;
    playback++;
    stage.replaceChildren();
    page.forEach(element => { element.inert = false; });
    document.documentElement.classList.remove('cpq-showing');
    if (wasOpen) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) Promise.resolve(exit.call(document)).then(restoreFocus, restoreFocus);
    }
    requestAnimationFrame(restoreFocus);
  }

  function restoreFocus() {
    if (player.hidden && !activeFullscreen()) launch.focus({ preventScroll: true });
  }

  function fullscreenChanged() {
    const entered = activeFullscreen() === player;
    if (wasFullscreen && !entered) closeShow();
    wasFullscreen = entered;
    if (player.hidden) restoreFocus();
    else fit();
  }

  function onKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'Escape': closeShow(); break;
      case 'ArrowLeft': case 'PageUp': showSlide(index - 1); break;
      case 'ArrowRight': case 'PageDown': showSlide(index + 1); break;
      case ' ': if (event.target.closest('button')) return; showSlide(index + 1); break;
      case 'Home': showSlide(0); break;
      case 'End': showSlide(slides.length - 1); break;
      default: return;
    }
    event.preventDefault();
  }

  launch.addEventListener('click', openShow);
  close.addEventListener('click', closeShow);
  previous.addEventListener('click', () => showSlide(index - 1));
  next.addEventListener('click', () => showSlide(index + 1));
  stage.addEventListener('click', () => showSlide(index + 1));
  player.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  new ResizeObserver(fit).observe(mat);
})();
