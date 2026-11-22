# Músicas do Lolly Rondocode

<a id="rondocode-songs"></a>

Uma música rondocode é música escrita como código: sintetizadores, padrões e uma mixagem, tocados enquanto você digita. O Lolly pode tocar uma música como fundo de um vídeo, e o utilitário **Rondocode** escreve músicas e as exporta como áudio; ambos registram a música nas Content Credentials do arquivo.

<!--i:eti-music-->
## Toque uma música no Lolly

O seletor de recursos aceita uma música como arquivo `.rondo` ou `.rondo.json`, ou como um link de compartilhamento de `rondocode.com` colado. Uma música toca pela duração que seu clipe pedir. Ela pode ser a **música de fundo** em uma exportação de vídeo ou tocar no player ambiente do Neurospicy Mode.

O código da música roda na sandbox do Lolly, sem rede e sem acesso aos seus arquivos. Qualquer parte que uma renderização não consegue tocar, como um microfone ao vivo ou canto sem os modelos de voz, é listada nos detalhes do recurso.

Pelo terminal, `lolly mix` aceita uma música como a trilha sonora inteira; veja [Renderização pela CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Escreva e exporte uma música

Abra a ferramenta **Rondocode** em **Utilities** para escrever uma música no editor ao vivo do rondocode e ouvi-la enquanto digita. Exporte-a como **WAV**, **MP3**, **M4A**, **Opus** ou **FLAC**, como um ZIP de stems, como **MIDI** ou como uma gravação do que está tocando. Pelo terminal, `lolly rondocode --export=mid` grava o mesmo arquivo MIDI. **Export length** define quantos segundos uma exportação de áudio dura. O arquivo da música (`.rondo.json`) é seu código como foi escrito, sem nada acrescentado.

Uma música pode cantar sua letra com `sing()`. Modelos de voz baixados produzem o canto no seu dispositivo. Um arquivo que contém canto sintetizado sempre declara o canto como gerado por IA (veja [Recursos de IA](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Músicas na credencial

Uma exportação de vídeo ou áudio que toca uma música rondocode registra cada música em suas Content Credentials como uma fonte:

- o nome da música;
- o SHA-256 de seu arquivo `.rondo.json`;
- como foi renderizada: na sandbox do Lolly, a classe de execução `vm`, com a versão e a semente do renderizador e qualquer parte que a renderização não conseguiu tocar.

Música calculada a partir do código de uma música é marcada como mídia algorítmica, então o Lolly Verify não a sinaliza como IA. Antes de você exportar, uma linha abaixo de **Download** lista as músicas que a credencial registrará. Depois da exportação, a mesma linha informa o que uma leitura do arquivo entregue encontrou. Desmarque **C2PA Credentials** para deixar o registro de fora. Uma imagem estática não registra nenhuma música, porque não tem som. Uma imagem estática não registra nenhuma música. `lolly mix` e o [servidor MCP](/info/mcp.html) gravam o mesmo registro.

<!--i:eti-file-->
## Arquivos do utilitário Rondocode

A maioria dos utilitários no dispositivo não grava credenciais, porque transforma um arquivo que você já tem. O Lolly Rondocode cria áudio novo, então todo arquivo de áudio que ele grava carrega Content Credentials que registram a música como sua fonte: WAV, MP3, M4A, Opus, FLAC, cada stem em um ZIP de stems e uma gravação do que está tocando.

- As renderizações do próprio editor rodam em seu frame privado (a classe de execução `frame`) e registram a versão do editor.
- Uma renderização feita pela CLI ou por um link de compartilhamento roda na classe `vm` e registra a versão e a semente do renderizador.
- Um WAV também declara o mesmo em seu comentário RIFF.

Quando uma música canta, a declaração de IA é legível por máquina. O tipo de fonte digital da credencial é mídia composta feita com modelos treinados, o registro lista as partes cantadas e uma declaração de IA C2PA por modelo identifica cada modelo pelo qual o canto passou: Supertonic-3 de texto para fala, o alinhador de fonemas wav2vec 2.0, o codificador ContentVec e a voz RVC, com o repositório e o commit usados pelo Lolly para hospedá-lo.

### O que o arquivo MIDI contém

O arquivo MIDI é um Standard MIDI File, formato 1. A primeira faixa contém o andamento e uma fórmula de compasso 4/4, seguida por uma faixa por sintetizador, com o nome do sintetizador. Cada nota mantém seu início, sua duração e sua velocidade. Um sintetizador cujo nome indica um instrumento, como baixo, cordas, pad ou piano, recebe o instrumento General MIDI correspondente, e um nome que remete a bateria vai para o canal 10. Uma afinação que não tem doze tons é arredondada para o semitom mais próximo com um pitch bend.

Um arquivo MIDI não pode conter as configurações do sintetizador, filtros, efeitos, barramentos, samples ou canto, então uma DAW toca as notas com seus próprios instrumentos. O andamento é lido dos ciclos por segundo da música com um ciclo como um compasso de quatro tempos, porque a fórmula de compasso da própria música não faz parte do que o renderizador retorna.

Um arquivo MIDI não tem lugar para uma credencial, então um evento de texto no arquivo carrega a declaração, e o painel de exportação informa isso. O painel descreve tudo isso antes de você exportar. Depois de cada exportação, o editor lê o arquivo salvo de volta e informa apenas o que essa leitura encontrou.

Para saber o que Content Credentials registram em geral, veja [Exportar um arquivo](/info/exporting.html#content-credentials-c2pa).
