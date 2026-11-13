/**
 * Emergency signs in the owner's words, checked before the model is called.
 * The rule errs on the side of caution: a false alarm costs one fixed
 * message; a missed emergency can cost the animal.
 */

/** Lowercase, without accents (ñ becomes n), single spaces. */
export const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Ate or swallowed, in the forms owners write it. */
const ATE = String.raw`(?:comio|se comio|trago|se trago|ingirio|lamio|mordio|se tomo|tomo)`;
const TOXIC = String.raw`(?:veneno|raticida|mata ratas|matarratas|chocolate|uvas|pasas|xilitol|cebolla|ibuprofeno|acetaminofen|paracetamol|cloro|anticongelante|insecticida|pastillas)`;

/** Each sign, matched against normalized text. */
const SIGNS: RegExp[] = [
  // Seizures.
  /\bconvuls\w*/,
  /\bataques? (?:epilept\w*|de epilepsia)\b/,
  // Breathing.
  /\bno (?:puede )?respira\w*/,
  /\bdificultad (?:para )?respira\w*/,
  /\b(?:le )?cuesta (?:mucho )?respirar\b/,
  /\bse (?:esta )?ahoga\w*/,
  // Poisoning.
  /\benvenen\w*/,
  /\bintoxic\w*/,
  /\braticida\b/,
  new RegExp(String.raw`\b${ATE}(?: \w+){0,5} ${TOXIC}\b`),
  // Heavy bleeding.
  /\bsangr\w* (?:mucho|abundante\w*|sin parar|demasiado|bastante)\b/,
  /\b(?:mucha|bastante|demasiada) sangre\b/,
  /\bhemorragi\w*/,
  // Hit by a vehicle.
  /\batropell\w*/,
  // Bloat: swollen belly with retching.
  /\b(?:abdomen|panza|barriga|estomago|pancita|guata)\b(?: \w+){0,3} (?:hinchad|inflamad|inflad|distendid)\w*(?: \w+){0,8} (?:arcadas?|quiere vomitar|intenta vomitar|trata de vomitar|no puede vomitar)\b/,
  /\b(?:arcadas?|quiere vomitar|intenta vomitar|trata de vomitar|no puede vomitar)\b(?: \w+){0,8} (?:abdomen|panza|barriga|estomago|pancita|guata)\b(?: \w+){0,3} (?:hinchad|inflamad|inflad|distendid)\w*/,
  // Not urinating.
  /\bno (?:puede )?orina\w*/,
  /\bno (?:ha|a) orinado\b/,
  /\bno (?:puede )?(?:hace|hacer) (?:pipi|pis|chichi)\b/,
  // Loss of consciousness.
  /\bperdi\w* (?:de )?(?:la )?conciencia\b/,
  /\binconscien\w*/,
  /\bdesmay\w*/,
  /\bno reacciona\b/,
  // Heat stroke.
  /\bgolpe de calor\b/,
  /\binsolacion\b/,
];

/** True when the text mentions any emergency sign. */
export function detectEmergency(text: string): boolean {
  const normalized = normalize(text);
  return SIGNS.some((sign) => sign.test(normalized));
}

/** Answer to an owner's emergency, sent without calling the model. */
export const EMERGENCY_REPLY =
  'Esto puede ser una emergencia. Llevá a tu mascota a una veterinaria de emergencias ahora mismo; ' +
  'si podés, llamá en el camino para avisar que van. Mientras tanto, mantenela tranquila, ' +
  'no le des medicamentos, comida ni remedios caseros y no intentes provocarle el vómito. ' +
  'No esperés a ver si mejora.';
