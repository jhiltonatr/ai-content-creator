const TOOLTIP_ID = 'storyforge-ai-tooltip';

function getTooltip(): HTMLElement {
  let el = document.getElementById(TOOLTIP_ID) as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = TOOLTIP_ID;
    el.className = 'ai-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function closestHighlight(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.ai-hl') as HTMLElement | null;
}

function readFinding(hl: HTMLElement): { msg: string; reason: string | null; suggestion: string | null } {
  return {
    msg: hl.getAttribute('data-msg') ?? '',
    reason: hl.getAttribute('data-reason'),
    suggestion: hl.getAttribute('data-sug'),
  };
}

export function attachAiTooltip(root: HTMLElement): () => void {
  let tooltip: HTMLElement | null = null;

  const position = (x: number, y: number) => {
    if (!tooltip) return;
    const pad = 10;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = x + pad;
    if (left + tw > window.innerWidth - 4) left = x - tw - pad;
    let top = y + pad;
    if (top + th > window.innerHeight - 4) top = y - th - pad;
    tooltip.style.left = `${Math.max(2, left)}px`;
    tooltip.style.top = `${Math.max(2, top)}px`;
  };

  const show = (hl: HTMLElement, x: number, y: number) => {
    const { msg, reason, suggestion } = readFinding(hl);
    if (!msg && !reason && !suggestion) return;
    tooltip = getTooltip();
    tooltip.innerHTML = '';
    const add = (className: string, text: string) => {
      if (!text) return;
      const row = document.createElement('div');
      row.className = className;
      row.textContent = text;
      tooltip!.appendChild(row);
    };
    add('ai-tooltip-msg', msg);
    add('ai-tooltip-reason', reason ? `Why: ${reason}` : '');
    add('ai-tooltip-suggestion', suggestion ? `Fix: ${suggestion}` : '');
    tooltip.style.display = 'block';
    position(x, y);
  };

  const hide = () => {
    if (tooltip) {
      tooltip.style.display = 'none';
      tooltip = null;
    }
  };

  const onOver = (e: MouseEvent) => {
    const hl = closestHighlight(e.target);
    if (hl) {
      show(hl, e.clientX, e.clientY);
    } else {
      hide();
    }
  };

  const onMove = (e: MouseEvent) => position(e.clientX, e.clientY);

  const onLeave = () => hide();

  root.addEventListener('mouseover', onOver);
  root.addEventListener('mousemove', onMove);
  root.addEventListener('mouseleave', onLeave);

  return () => {
    root.removeEventListener('mouseover', onOver);
    root.removeEventListener('mousemove', onMove);
    root.removeEventListener('mouseleave', onLeave);
    hide();
  };
}