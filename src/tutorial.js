/** Patch's guided tour is presentation only: it never runs commands or changes a mission. */
const steps = [
  {
    target: '.mission-scene',
    title: 'A story worth following.',
    copy: 'Patch here! Nova’s brief tells you what’s happening in the valley and why we need your help. Read the scene, follow the clues, and take your time. Our adventure starts a little silly, then grows into more realistic security work.',
    example: 'Everything happens in our training world. Your computer and real systems stay untouched.'
  },
  {
    target: '.objectives-card',
    title: 'Little moves. Real progress.',
    copy: 'These are the pieces of evidence Nova needs. Read each clue, then do what it asks in the terminal. A box turns green when your action is verified. Guessing a command isn’t enough — the right evidence has to be there.',
    example: 'Collect the evidence and make your call before finishing the stop.'
  },
  {
    target: '.terminal-window',
    title: 'Your words move the adventure.',
    copy: 'Type a command here and press Enter to see what happens. Start with small questions: where am I, who am I, and what does this file say? Try the tiny preview below — it won’t change your mission.',
    demo: true
  },
  {
    target: '.hint-companion',
    title: 'I’m right here when you need me.',
    copy: 'Stuck? Ask me for a nudge. The first hint points you in the right direction; the next ones get more specific. Hints never stop you completing the trail. You can always replay a stop and try it more independently.',
    example: 'There’s no race. A good question is part of learning.'
  },
  {
    target: '.decision-card',
    title: 'Find the clues. Then make the call.',
    copy: 'Commands help us find evidence. This is where you decide what it means. Collect the other clues first, then choose the response you can support. Nova will explain your choice, and you can try again if it doesn’t fit.',
    example: 'Security work is about good judgment as well as useful commands.'
  },
  {
    target: '.trail-progress',
    title: 'One stop opens the next.',
    copy: 'Finish the checklist, answer Nova’s question, and leave a note if you like. That clears the stop and opens the next one. The whole Hike Trail builds your foundation. The Office and Night Shift are waiting further down the road.',
    example: 'Ready? Finish this tour, then start your mission. I’ll be beside you.'
  }
];

const previews = [
  { command: 'pwd', meaning: '“Print working directory” shows where you are.', output: '/home/trainee' },
  { command: 'whoami', meaning: 'Shows which account you are using.', output: 'trainee' },
  { command: 'cat trail-note.txt', meaning: 'Reads a text file so you can follow its clues.', output: 'Patch’s trail note: follow the snack crumbs toward the signal tower.' }
];

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}
function control(label, testId, action, className) {
  const button = node('button', className, label);
  button.type = 'button';
  button.dataset.testid = testId;
  button.dataset.tourAction = action;
  return button;
}

export function createTutorial({ onComplete, onClose } = {}) {
  let opened = false, index = 0, completed = false, frame = 0, refreshTarget = false;
  let backdrop, card, spotlight, previousFocus, previousOverflow;

  function target() { return document.querySelector(steps[index].target); }

  function position({ scroll = false } = {}) {
    if (!opened) return;
    const anchor = target();
    const viewport = window.visualViewport;
    const overlayStyle = window.getComputedStyle(backdrop);
    const safeInset = side => Number.parseFloat(overlayStyle.getPropertyValue(`--tour-safe-${side}`)) || 0;
    const width = (viewport?.width || window.innerWidth) - safeInset('left') - safeInset('right');
    const height = (viewport?.height || window.innerHeight) - safeInset('top') - safeInset('bottom');
    const viewportLeft = (viewport?.offsetLeft || 0) + safeInset('left'), viewportTop = (viewport?.offsetTop || 0) + safeInset('top');
    const viewportRight = viewportLeft + width, viewportBottom = viewportTop + height;
    const compact = window.innerWidth <= 900 || height < 500, margin = compact ? 12 : 18, gap = 14;
    card.style.width = `${Math.max(1, Math.min(360, width - margin * 2))}px`;
    // Leave the highlighted heading in view while giving the explanation room to breathe.
    const headingSpace = compact ? Math.min(96, height * .24) : 0;
    card.style.maxHeight = `${Math.max(1, Math.min(compact ? Math.min(460, height * .62) : 440, height - margin * 2 - headingSpace - (compact ? gap : 0)))}px`;
    if (scroll && anchor) {
      const header = document.querySelector('.site-header');
      const headerStyle = header && window.getComputedStyle(header);
      const headerBottom = header && ['sticky', 'fixed'].includes(headerStyle.position) ? Math.max(viewportTop, header.getBoundingClientRect().bottom) : viewportTop;
      const top = Math.max(viewportTop + margin + 8, headerBottom + margin);
      const destination = Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - top);
      // Instant movement keeps each highlighted heading visible without animation or a timer.
      window.scrollTo({ top: destination, behavior: 'instant' });
    }
    const rect = anchor?.getBoundingClientRect();
    const panel = card.getBoundingClientRect();
    let left = viewportLeft + (width - panel.width) / 2, top = viewportBottom - panel.height - margin;
    if (rect && !compact) {
      if (viewportRight - rect.right - gap - margin >= panel.width) {
        left = rect.right + gap;
        top = rect.top;
      } else if (rect.left - viewportLeft - gap - margin >= panel.width) {
        left = rect.left - gap - panel.width;
        top = rect.top;
      } else if (viewportBottom - rect.bottom - gap - margin >= panel.height) {
        top = rect.bottom + gap;
      } else if (rect.top - viewportTop - gap - margin >= panel.height) {
        top = rect.top - gap - panel.height;
      }
    }
    left = Math.max(viewportLeft + margin, Math.min(left, viewportRight - panel.width - margin));
    top = Math.max(viewportTop + margin, Math.min(top, viewportBottom - panel.height - margin));
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    if (!rect) { spotlight.classList.add('hidden'); return; }
    let highlightLeft = Math.max(viewportLeft + margin, rect.left - 7);
    let highlightTop = Math.max(viewportTop + margin, rect.top - 7);
    let highlightRight = Math.min(viewportRight - margin, rect.right + 7);
    let highlightBottom = Math.min(viewportBottom - margin, rect.bottom + 7);
    // A tall terminal can extend under a bottom sheet: keep its heading illuminated above it.
    if (left < highlightRight && left + panel.width > highlightLeft && top > highlightTop && top < highlightBottom) {
      highlightBottom = top - gap;
    }
    if (highlightBottom <= highlightTop || highlightRight <= highlightLeft) { spotlight.classList.add('hidden'); return; }
    spotlight.classList.remove('hidden');
    Object.assign(spotlight.style, {
      left: `${Math.round(highlightLeft)}px`, top: `${Math.round(highlightTop)}px`,
      width: `${Math.round(highlightRight - highlightLeft)}px`, height: `${Math.round(highlightBottom - highlightTop)}px`
    });
  }

  function queuePosition() {
    if (!opened || frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const scroll = refreshTarget;
      refreshTarget = false;
      position({ scroll });
    });
  }

  function viewportChanged() {
    refreshTarget = true;
    queuePosition();
  }

  function render() {
    const step = steps[index];
    card.dataset.step = String(index + 1);
    card.dataset.target = step.target;
    card.replaceChildren();
    const header = node('div', 'tour-header');
    const portrait = node('div', 'tour-avatar');
    portrait.setAttribute('aria-hidden', 'true');
    Object.assign(portrait.style, { backgroundImage: 'url("assets/characters/companions.webp")', backgroundPosition: 'right center', backgroundSize: '200% 100%' });
    const heading = node('div', 'tour-heading');
    heading.append(node('div', 'tour-speaker', 'PATCH · YOUR TRAIL COMPANION'));
    const progress = node('span', 'tour-progress', `${index + 1} / ${steps.length}`);
    progress.dataset.testid = 'tour-progress';
    progress.setAttribute('aria-label', `Tutorial step ${index + 1} of ${steps.length}`);
    progress.setAttribute('aria-live', 'polite');
    header.append(portrait, heading, progress);
    const title = node('h2', 'tour-title', step.title);
    title.id = 'tour-title';
    const copy = node('p', 'tour-copy', step.copy);
    const example = node('div', 'tour-example');
    if (step.demo) {
      const choices = node('div', 'tour-demo-controls');
      previews.forEach((preview, previewIndex) => {
        const button = control(preview.command, `tour-demo-${previewIndex}`, 'demo', 'tour-demo-command');
        button.dataset.preview = String(previewIndex);
        button.setAttribute('aria-pressed', String(previewIndex === 0));
        choices.append(button);
      });
      const meaning = node('p', 'tour-demo-meaning');
      const output = node('pre', 'tour-demo-output');
      output.setAttribute('aria-live', 'polite');
      example.append(choices, meaning, output);
      showPreview(0, example);
    } else example.textContent = step.example;
    const footer = node('div', 'tour-footer');
    const back = control('← Back', 'tour-back', 'back', 'tour-back');
    back.disabled = index === 0;
    footer.append(back, control('Skip tour', 'tour-skip', 'skip', 'tour-skip'), control(index === steps.length - 1 ? 'Finish tour →' : 'Next →', 'tour-next', 'next', 'tour-next'));
    card.append(header, title, copy, example, footer);
    card.scrollTop = 0;
    position({ scroll: true });
    queuePosition();
  }

  function showPreview(previewIndex, root = card) {
    const preview = previews[previewIndex];
    root.querySelector('.tour-demo-meaning').textContent = preview.meaning;
    root.querySelector('.tour-demo-output').textContent = `$ ${preview.command}\n${preview.output}`;
    root.querySelectorAll('[data-preview]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.preview) === previewIndex)));
    queuePosition();
  }

  function click(event) {
    const button = event.target.closest('button[data-tour-action]');
    if (!button || !card.contains(button) || button.disabled) return;
    const action = button.dataset.tourAction;
    if (action === 'skip' || (action === 'next' && index === steps.length - 1)) return close({ complete: true });
    if (action === 'demo') return showPreview(Number(button.dataset.preview));
    if (action === 'back') index = Math.max(0, index - 1);
    if (action === 'next') index = Math.min(steps.length - 1, index + 1);
    render();
    card.querySelector('[data-testid="tour-next"]').focus({ preventScroll: true });
  }

  function keys(event) {
    if (!opened) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      close({ complete: true });
    } else if (event.key === 'Tab') {
      const controls = [...card.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length);
      if (!controls.length) { event.preventDefault(); card.focus(); return; }
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!card.contains(active) || active === card || (event.shiftKey && active === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
      event.stopPropagation();
    }
  }

  function open() {
    if (opened) close();
    backdrop = document.querySelector('#tutorial-backdrop');
    card = backdrop?.querySelector('.tour-card');
    spotlight = backdrop?.querySelector('.tour-spotlight');
    if (!backdrop || !card || !spotlight) throw new Error('The guided tour needs its tutorial dialog container.');
    index = 0; completed = false; opened = true;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    backdrop.classList.remove('hidden');
    backdrop.dataset.open = 'true';
    card.onclick = click;
    document.addEventListener('keydown', keys, true);
    window.addEventListener('resize', viewportChanged);
    window.addEventListener('scroll', queuePosition, { passive: true });
    window.visualViewport?.addEventListener('resize', viewportChanged);
    window.visualViewport?.addEventListener('scroll', queuePosition);
    render();
    card.focus({ preventScroll: true });
  }

  function close({ complete = false } = {}) {
    if (!opened) return;
    opened = false;
    backdrop.classList.add('hidden');
    delete backdrop.dataset.open;
    card.onclick = null;
    document.removeEventListener('keydown', keys, true);
    window.removeEventListener('resize', viewportChanged);
    window.removeEventListener('scroll', queuePosition);
    window.visualViewport?.removeEventListener('resize', viewportChanged);
    window.visualViewport?.removeEventListener('scroll', queuePosition);
    if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
    refreshTarget = false;
    // Restore the value owned by this tour rather than replacing the page's prior scroll setting.
    document.body.style.overflow = previousOverflow;
    const focus = previousFocus?.isConnected && previousFocus.getClientRects().length ? previousFocus : document.querySelector('#start-mission');
    focus?.focus({ preventScroll: true });
    const shouldComplete = complete && !completed;
    completed ||= complete;
    try { if (shouldComplete) onComplete?.(); }
    finally { onClose?.(); }
  }

  return { open, close, isOpen: () => opened };
}
