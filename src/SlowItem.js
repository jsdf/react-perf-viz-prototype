export default function SlowItem(props) {
  const start = Date.now();
  while (Date.now() < start + 20) {
    Math.round(Math.random());
  }

  return props.item;
}
