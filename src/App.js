import React from 'react';
import logo from './logo.svg';
import './App.css';
import {unstable_Profiler as Profiler} from 'react';
import {
  unstable_trace as trace,
  unstable_wrap as wrap,
} from 'scheduler/tracing';

import {__subscriberRef as subscriberRef} from 'scheduler/tracing';

import Trace from './Trace';

const {useState, useCallback, useRef} = React;

function SlowItem(props) {
  const start = Date.now();
  while (Date.now() < start + 20) {
    Math.round(Math.random());
  }

  return props.item;
}

let updateTrace = data => {};

const interactionTrace = [];
let executionBlockID = 0;
let interactionID = 0;
let reactInstanceID = 0;
const stateChangeMap = new Map();
const executionBlocks = [];
let currentExecutionBlock = null;
function wrappedExecution(cb) {
  const currentID = executionBlockID++;
  return wrap(function wrapped(...args) {
    let createdBlock = false;
    if (currentExecutionBlock == null) {
      createdBlock = true;
      currentExecutionBlock = {
        id: currentID,
        startTime: performance.now(),
        interactions: [],
      };
      executionBlocks.push(currentExecutionBlock);
    }

    const ret = cb.apply(this, args);

    if (createdBlock === true) {
      currentExecutionBlock.endTime = performance.now();
      interactionTrace.push({
        id: currentExecutionBlock.id,
        name: `${currentExecutionBlock.id}`,
        startTime: currentExecutionBlock.startTime,
        duration:
          currentExecutionBlock.endTime - currentExecutionBlock.startTime,
        group: 'executionBlocks',
      });
      currentExecutionBlock = null;
    }

    return ret;
  });
}

function traceWithID(instance, interactionName, cb) {
  const id = `${executionBlockID}:${
    instance.current
  }:${interactionID++}:${interactionName}`;
  if (currentExecutionBlock != null) {
    currentExecutionBlock.interactions.push(id);
  }
  console.log(id);
  trace(id, performance.now(), () =>
    cb((prevState, nextState) => {
      stateChangeMap.set(id, {prevState, nextState});
    })
  );
}

let reactCommitID = 0;
function profilerOnRender(
  id, //: string,
  phase, //: "mount" | "update",
  actualDuration, //: number,
  baseDuration, //: number,
  startTime, //: number,
  commitTime, //: number,
  interactions //: Set<{ name: string, timestamp: number }>,
) {
  const interactionsData = new Map(
    Array.from(interactions).map(interaction => [
      interaction.name,
      {stateChanges: stateChangeMap.get(interaction.name), interaction},
    ])
  );

  const executionBlocksRelated = executionBlocks.filter(block =>
    block.interactions.some(blockInteraction =>
      interactionsData.has(blockInteraction)
    )
  );

  executionBlocksRelated.forEach(block => {
    block.interactions.forEach(interactionID => {
      const interactionData = interactionsData.get(interactionID);
      if (interactionData) {
        interactionData.causalBlocks = interactionData.causalBlocks || [];
        interactionData.causalBlocks.push(block);
      }
    });
  });

  const commitID = reactCommitID++;

  const traceItem = {
    interactionID: id,
    commitID,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions,
    interactionsData,
    executionBlocksRelated,
  };

  interactionTrace.push({
    id: commitID,
    name: id,
    startTime,
    duration: commitTime - startTime,
    group: 'reactCommits',
    args: {
      interactionNames: Array.from(interactions).map(({name}) => name),
    },
  });

  console.log('calling updateTrace');
  updateTrace(interactionTrace.slice());

  Array.from(interactionsData.values()).forEach(interactionData => {
    interactionTrace.push({
      id: interactionData.interaction.id,
      name: `${interactionData.interaction.name} -> commit ${commitID}`,
      startTime: interactionData.interaction.timestamp,
      duration: commitTime - interactionData.interaction.timestamp,
      group: 'interactions',
      args: {
        stateChanges: interactionData.stateChanges,
      },
    });
  });

  console.log(traceItem, JSON.stringify(interactionTrace));
}

function List() {
  const [items, setItems] = useState([]);

  const instance = useRef(reactInstanceID++);

  const makeAPIRequest = useCallback(() => {
    traceWithID(instance, 'load_list_items', logStateChange => {
      wrappedExecution(() => {
        const loadingStates = [];
        const lastNumItems = items.length;
        for (var i = lastNumItems; i < lastNumItems + 5; i++) {
          loadingStates.push(i);
          const currentIdx = i;
          console.log('loading', currentIdx);
          setTimeout(
            wrappedExecution(() => {
              console.log('loaded', currentIdx);
              traceWithID(instance, 'list_item_loaded', logStateChange => {
                setItems(prevState => {
                  const nextState = prevState.slice();
                  nextState[
                    currentIdx
                  ] = `${currentIdx} Loaded: ${Math.random()}`;
                  logStateChange(prevState, nextState);
                  return nextState;
                });
              });
            }),
            Math.random() * 100 + 400
          );
        }
        setItems(prevState => {
          const nextState = prevState.slice();
          loadingStates.forEach(i => {
            nextState[i] = `${i} Loading`;
          });
          logStateChange(prevState, nextState);
          return nextState;
        });
      })();
    });
  });

  return (
    <div>
      <button onClick={makeAPIRequest}>load</button>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <SlowItem item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TraceWithState() {
  const [trace, setTrace] = useState([]);
  updateTrace = setTrace;
  console.log('TraceWithState', {trace});
  return <Trace trace={trace} />;
}

function Demo() {
  return (
    <Profiler id="Application" onRender={profilerOnRender}>
      <React.unstable_ConcurrentMode>
        <List />
      </React.unstable_ConcurrentMode>
    </Profiler>
  );
}

function App() {
  return (
    <div className="App">
      <Demo />
      <TraceWithState />
    </div>
  );
}

export default App;
