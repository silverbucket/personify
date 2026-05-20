import { COLORS } from './indices.js';

const SECTIONS = [
  {
    label: 'Face Shape',
    color: COLORS.face,
    rows: [
      { key: 'faceRatio',  label: 'Width / Height', unit: 'ratio' },
      { key: 'cheekWidth', label: 'Cheek width',     unit: '%' },
    ],
  },
  {
    label: 'Forehead',
    color: '#94a3b8',
    rows: [
      { key: 'foreheadH', label: 'Height',     unit: '%' },
      { key: 'interBrow', label: 'Inter-brow', unit: '%' },
    ],
  },
  {
    label: 'Hairline',
    color: '#a78bfa',
    rows: [
      { key: 'hairlineHeight', label: 'Height',     unit: '%' },
      { key: 'hairlineShape',  label: 'Shape',      unit: 'text' },
      { key: 'hairlineConf',   label: 'Confidence', unit: '%' },
    ],
  },
  {
    label: 'Eyebrows',
    color: COLORS.brows,
    rows: [
      { key: 'lBrowLen',   label: 'Left length',   unit: '%' },
      { key: 'rBrowLen',   label: 'Right length',  unit: '%' },
      { key: 'lBrowArch',  label: 'Left arch',     unit: '%' },
      { key: 'rBrowArch',  label: 'Right arch',    unit: '%' },
      { key: 'lBrowAngle', label: 'Left angle',    unit: '°' },
      { key: 'rBrowAngle', label: 'Right angle',   unit: '°' },
    ],
  },
  {
    label: 'Eyes',
    color: COLORS.eyes,
    rows: [
      { key: 'lEyeWidth', label: 'Left width',     unit: '%' },
      { key: 'rEyeWidth', label: 'Right width',    unit: '%' },
      { key: 'lEyeOpen',  label: 'Left openness',  unit: '%' },
      { key: 'rEyeOpen',  label: 'Right openness', unit: '%' },
      { key: 'interEye',  label: 'Inter-eye dist', unit: '%' },
      { key: 'lEyeColor', label: 'Left colour',    unit: 'color' },
      { key: 'rEyeColor', label: 'Right colour',   unit: 'color' },
    ],
  },
  {
    label: 'Nose',
    color: COLORS.nose,
    rows: [
      { key: 'noseWidth', label: 'Width',  unit: '%' },
      { key: 'noseLen',   label: 'Length', unit: '%' },
    ],
  },
  {
    label: 'Lips',
    color: COLORS.lips,
    rows: [
      { key: 'mouthWidth', label: 'Mouth width', unit: '%' },
      { key: 'upperLipH',  label: 'Upper lip',   unit: '%' },
      { key: 'lowerLipH',  label: 'Lower lip',   unit: '%' },
    ],
  },
  {
    label: 'Jaw',
    color: COLORS.jaw,
    rows: [
      { key: 'jawWidth', label: 'Width',       unit: '%' },
      { key: 'jawRatio', label: 'Jaw / cheek', unit: '%' },
    ],
  },
];

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

// Build panel DOM once; returns refs to value elements for fast updates.
export function buildPanel(container) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const refs = {};

  for (const section of SECTIONS) {
    const sec  = el('div', 'sec');
    const head = el('div', 'sec-head');
    head.style.borderLeftColor = section.color;
    head.style.color = section.color;
    head.textContent = section.label;
    sec.appendChild(head);

    for (const row of section.rows) {
      const rowEl   = el('div', 'row');
      const labelEl = el('span', 'row-label');
      labelEl.textContent = row.label;
      const valEl   = el('span', 'row-val');
      valEl.textContent = '—';

      if (row.unit === 'color') {
        const swatch = el('span', 'color-swatch');
        rowEl.appendChild(labelEl);
        rowEl.appendChild(swatch);
        rowEl.appendChild(valEl);
        refs[row.key] = { valEl, swatch };
      } else {
        rowEl.appendChild(labelEl);
        rowEl.appendChild(valEl);
        refs[row.key] = { valEl };
      }

      sec.appendChild(rowEl);
    }

    container.appendChild(sec);
  }

  return refs;
}

export function updatePanel(refs, m) {
  for (const section of SECTIONS) {
    for (const row of section.rows) {
      const ref = refs[row.key];
      if (!ref) continue;

      if (!m) {
        ref.valEl.textContent = '—';
        if (ref.swatch) ref.swatch.style.backgroundColor = '#333';
        continue;
      }

      const val = m[row.key];
      if (val === undefined || val === null) {
        ref.valEl.textContent = '—';
        continue;
      }

      if (row.unit === 'color') {
        if (val && val.hex) {
          ref.valEl.textContent = val.name;
          if (ref.swatch) ref.swatch.style.backgroundColor = val.hex;
        }
      } else if (row.unit === 'text') {
        ref.valEl.textContent = val;
      } else if (row.unit === 'ratio') {
        ref.valEl.textContent = Number(val).toFixed(2);
      } else {
        ref.valEl.textContent = `${Number(val).toFixed(1)}${row.unit}`;
      }
    }
  }
}
