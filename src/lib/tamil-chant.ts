/** Mechanical IAST-to-Tamil pronunciation aid. It is not a Tamil translation. */
const vowels: Record<string, [string, string]> = {
  a: ["அ", ""], ā: ["ஆ", "ா"], i: ["இ", "ி"], ī: ["ஈ", "ீ"], u: ["உ", "ு"], ū: ["ஊ", "ூ"],
  ṛ: ["ரு", "்ரு"], ṝ: ["ரூ", "்ரூ"], ḷ: ["லு", "்லு"], e: ["ஏ", "ே"], ai: ["ஐ", "ை"], o: ["ஓ", "ோ"], au: ["ஔ", "ௌ"],
};
const consonants: Record<string, [string, string]> = {
  kh: ["க", "²"], gh: ["க", "⁴"], ch: ["ச", "²"], jh: ["ஜ", "²"], ṭh: ["ட", "²"], ḍh: ["ட", "⁴"], th: ["த", "²"], dh: ["த", "⁴"], ph: ["ப", "²"], bh: ["ப", "⁴"],
  k: ["க", ""], g: ["க", "³"], ṅ: ["ங", ""], c: ["ச", ""], j: ["ஜ", ""], ñ: ["ஞ", ""], ṭ: ["ட", ""], ḍ: ["ட", "³"], ṇ: ["ண", ""], t: ["த", ""], d: ["த", "³"], n: ["ந", ""], p: ["ப", ""], b: ["ப", "³"], m: ["ம", ""], y: ["ய", ""], r: ["ர", ""], l: ["ல", ""], v: ["வ", ""], ś: ["ஶ", ""], ṣ: ["ஷ", ""], s: ["ஸ", ""], h: ["ஹ", ""],
};
const special: Record<string, string> = { "ṁ": "ம்", "ṃ": "ம்", "ḥ": "ஃ", "’": "ऽ", "'": "ऽ" };
const tokens = /kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|ai|au|[\s\S]/gu;
export function tamilChant(iast: string): string {
  const parts = iast.normalize("NFC").toLowerCase().match(tokens) ?? [];
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const current = parts[i];
    const consonant = consonants[current];
    if (consonant) {
      const next = vowels[parts[i + 1]];
      result += consonant[0] + (next ? next[1] : "்") + consonant[1];
      if (next) i++;
    } else result += vowels[current]?.[0] ?? special[current] ?? current;
  }
  return result;
}
