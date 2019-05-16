import React from 'react';
import calculateTraceLayout from './calculateTraceLayout';

const {useState, useMemo, useEffect, useRef} = React;

const BAR_HEIGHT = 30;
const PX_BASE = 1;

const VIEW_HEIGHT = 600;
const PAN_AMOUNT = 100; //0.05

function last(arr) {
  return arr[arr.length - 1];
}

export default function Trace(props) {
  const renderableTrace = useMemo(() => calculateTraceLayout(props.trace), [
    props.trace,
  ]);

  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(1);

  const mutableState = useRef({offset, zoom});
  Object.assign(mutableState.current, {offset, zoom});

  useEffect(() => {
    document.addEventListener('keypress', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'w': {
          setZoom(zoom => zoom * 2);
          break;
        }
        case 'a': {
          setOffset(offset =>
            Math.max(offset - PAN_AMOUNT / mutableState.current.zoom, 0)
          );
          break;
        }
        case 's': {
          setZoom(zoom => zoom / 2);
          break;
        }
        case 'd': {
          setOffset(offset =>
            Math.max(offset + PAN_AMOUNT / mutableState.current.zoom, 0)
          );
          break;
        }
      }
    });
  }, []);

  const lastMeasure = last(renderableTrace);
  const viewWidth = window.innerWidth;

  console.log({offset, zoom});

  return (
    <svg
      viewBox={`${
        lastMeasure
          ? lastMeasure.measure.startTime * PX_BASE - viewWidth + offset
          : 0
      } 0 ${viewWidth} ${VIEW_HEIGHT}`}
    >
      {renderableTrace.map((measure, i) => (
        <g key={i}>
          <g fill="red">
            <rect
              x={measure.measure.startTime * PX_BASE * zoom}
              y={measure.stackIndex * BAR_HEIGHT}
              width={measure.measure.duration * PX_BASE * zoom}
              height={BAR_HEIGHT}
            />
          </g>
          <text
            x={measure.measure.startTime * PX_BASE * zoom}
            y={measure.stackIndex * BAR_HEIGHT}
          >
            {measure.measure.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
