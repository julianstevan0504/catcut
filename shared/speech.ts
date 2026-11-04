const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
export function isSpeechEcho(heard: string, spoken: string) {
  const a = words(heard),
    b = words(spoken);
  if (a.length < 5 || b.length < 5) return false;
  const source = " " + b.join(" ") + " ";
  if (source.includes(" " + a.join(" ") + " ")) return true;
  const shared = a.filter((w) => b.includes(w)).length / a.length;
  let contiguous = 0;
  for (let i = 0; i < a.length - 2; i++)
    if (source.includes(" " + a.slice(i, i + 3).join(" ") + " ")) contiguous++;
  return shared >= 0.95 && contiguous >= 2;
}
export function interruptionOnly(text: string, name: string) {
  const q = words(text).join(" "),
    n = words(name).join(" ");
  return (
    /^(espera|esperate|para|parate|un momento|silencio|alto|detente|callate|basta|dejame hablar|escuchame)( por favor)?$/.test(
      q,
    ) ||
    q === "oye " + n ||
    q === n
  );
}
