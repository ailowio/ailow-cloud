import { useState } from 'react';
import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { IconInfoCircle, IconUsers } from '@tabler/icons-react';
import { ErroApi } from '../api/cliente';
import { avisarErro } from '../lib/avisos';
import { mensagemEntrar } from '../acesso/mensagens';
import { Moldura } from './Moldura';

/** RF-ACE-02: o Dono entra com e-mail + senha e o aparelho fica vinculado à empresa. */
export function Entrar(props: {
  aviso?: string;
  aoEntrar: (email: string, senha: string) => Promise<void>;
  /** Só existe com aparelho vinculado: volta a "Quem está usando?" (sem isso, "Sair" seria um beco sem saída). */
  aoTrocarUsuario?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      await props.aoEntrar(email.trim(), senha);
    } catch (e) {
      // UXM-04: erro como toast, sem mexer no formulário.
      avisarErro(mensagemEntrar(e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno')));
      setEnviando(false);
    }
  }

  return (
    <Moldura titulo="Entrar" subtitulo="Use o e-mail e a senha do Dono. Isso é feito uma vez por aparelho.">
      <form onSubmit={enviar} noValidate>
        <Stack gap="md">
          {props.aviso && (
            <Alert color="azul" icon={<IconInfoCircle />} role="status">{props.aviso}</Alert>
          )}
          <TextInput
            label="E-mail"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="dono@minhaloja.com.br"
            required
            size="lg"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Senha"
            autoComplete="current-password"
            required
            size="lg"
            value={senha}
            onChange={(e) => setSenha(e.currentTarget.value)}
          />
          <Button type="submit" loading={enviando} disabled={!email || !senha}>Entrar</Button>
          {props.aoTrocarUsuario && (
            <Button type="button" variant="subtle" h={48} leftSection={<IconUsers size={20} aria-hidden />} onClick={props.aoTrocarUsuario}>
              Trocar de usuário
            </Button>
          )}
        </Stack>
      </form>
    </Moldura>
  );
}
