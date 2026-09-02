/**
 * Máscara de telefone brasileiro, compartilhada por todos os formulários que
 * pedem contato (polos, negociações, escolas técnicas, acompanhamentos).
 */

/**
 * Formata como "(79) 99999-9999".
 *
 * Descarta tudo que não é dígito e limita a 11 (DDD + 9). Formata
 * progressivamente para o campo não "pular" enquanto se digita, e cobre tanto
 * fixo (10 dígitos) quanto celular (11).
 */
export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Aplica a máscara só quando o valor guardado realmente parece um telefone.
 *
 * Registros antigos podem ter texto livre no campo contato (um nome, por
 * exemplo); mascarar isso apagaria as letras e corromperia o dado ao salvar.
 */
export function formatarTelefoneSeAplicavel(valor: string): string {
  if (!valor) return "";
  if (!/^[\d\s()+.-]+$/.test(valor)) return valor;
  return formatarTelefone(valor);
}

/** Props comuns do input de telefone, para os formulários não divergirem. */
export const TELEFONE_INPUT_PROPS = {
  type: "tel",
  inputMode: "numeric",
  maxLength: 15,
  placeholder: "(00) 00000-0000",
} as const;
