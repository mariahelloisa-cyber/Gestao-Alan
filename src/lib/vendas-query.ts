import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVendas } from "./vendas.functions";

/** Mesma chave usada por VendasPolo: cadastrar/excluir venda invalida todas as telas. */
export const VENDAS_QUERY_KEY = ["vendas-polos"];

export function useVendasQuery() {
  const listFn = useServerFn(listVendas);
  return useQuery({ queryKey: VENDAS_QUERY_KEY, queryFn: () => listFn(), retry: 1 });
}
