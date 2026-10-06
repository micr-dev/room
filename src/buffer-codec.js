// Reversible predictors operate on integer bit patterns, preserving every float bit.
export function predictWords(words, predictor, encode = false) {
  if (!predictor) return;
  const { mode, stride } = predictor;
  if (
    !["xor", "delta"].includes(mode) ||
    !Number.isSafeInteger(stride) ||
    stride < 1 ||
    stride > 16
  )
    throw Error("Invalid buffer predictor");
  if (encode) {
    for (let i = words.length - 1; i >= stride; i--)
      words[i] =
        mode === "xor"
          ? words[i] ^ words[i - stride]
          : words[i] - words[i - stride];
  } else
    for (let i = stride; i < words.length; i++)
      words[i] =
        mode === "xor"
          ? words[i] ^ words[i - stride]
          : words[i] + words[i - stride];
}
