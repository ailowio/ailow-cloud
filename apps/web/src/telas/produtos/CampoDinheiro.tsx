import { Text, TextInput } from '@mantine/core';
import { digitosParaCentavos, mascaraCentavos } from './valores-produto';

/**
 * Campo monetário para o celular (S10): teclado numérico, só os dígitos contam e os dois últimos são os centavos
 * (toca 4-5-0-0 e vê 45,00), valor grande e em destaque. O valor é sempre inteiro em centavos (RN-01).
 */
export function CampoDinheiro(props: {
  label: string;
  valor: number | null;
  aoMudar: (centavos: number | null) => void;
  erro?: string;
  descricao?: string;
  autoFoco?: boolean;
}) {
  return (
    <TextInput
      label={props.label}
      required
      size="xl"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={props.autoFoco}
      placeholder="0,00"
      leftSection={<Text fw={700}>R$</Text>}
      leftSectionWidth={48}
      value={mascaraCentavos(props.valor)}
      onChange={(e) => props.aoMudar(digitosParaCentavos(e.currentTarget.value))}
      error={props.erro}
      description={props.descricao}
      // 28 px bold: o maior valor (20.000.000,00) ainda cabe em 360 px.
      styles={{ input: { fontSize: 28, fontWeight: 700, height: 72, letterSpacing: '-0.02em', paddingRight: 8 } }}
    />
  );
}
