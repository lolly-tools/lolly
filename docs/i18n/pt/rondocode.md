# Músicas do Rondocode

Uma música rondocode é música escrita como código: sintetizadores, padrões e uma mixagem, tocados enquanto você digita. O Lolly pode tocar uma música sob um vídeo, e o utilitário **Rondocode** permite escrever uma e exportá-la como áudio. Ambos registram a música nas Content Credentials do arquivo, para que a música diga de onde veio.

## Toque uma música no Lolly

O seletor de recursos aceita uma música como arquivo `.rondo` ou `.rondo.json`, ou como um link de compartilhamento `rondocode.com` colado. Uma música é um código que cria o próprio som, então toca na duração que o clipe dela pedir. Ela pode ser a **base musical** de uma exportação de vídeo ou tocar no player ambiente do Neurospicy Mode.

O código da música roda no sandbox do Lolly, sem rede e sem acesso aos seus arquivos. Qualquer parte que uma renderização não consegue tocar, como um microfone ao vivo, ou o canto sem os modelos de voz, é listada nos detalhes do recurso.

Pelo terminal, `lolly mix` recebe uma música como trilha sonora inteira; veja [CLI rendering](/info/cli-rendering.html).

## Escreva e exporte uma música

Abra **Rondocode** em **Utilities** para escrever uma música no editor ao vivo do rondocode e ouvi-la enquanto digita. Exporte-a como **WAV**, **MP3**, **M4A**, **Opus** ou **FLAC**, como um ZIP de stems, como **MIDI**, ou como uma gravação do que está tocando. **Export length** define quantos segundos dura uma exportação de áudio. O arquivo da música (`.rondo.json`) é o seu código como escrito e não leva nada acrescentado.

Uma música pode cantar a letra com `sing()`. O canto é feito no seu dispositivo por modelos de voz baixados, e um arquivo que contém canto sintetizado sempre declara o canto como gerado por IA (veja [AI features](/info/ai-features.html)).

## Músicas na credencial

Uma exportação de vídeo ou áudio que toca uma música rondocode registra cada música nas Content Credentials como uma origem:

- o nome da música;
- o SHA-256 do arquivo `.rondo.json` dela;
- como foi renderizada: no sandbox do Lolly, a classe de execução `vm`, com a versão e a semente do renderizador, e qualquer parte que a renderização não conseguiu tocar.

A música calculada a partir do código de uma música é marcada como mídia algorítmica, então o Verify não a sinaliza como IA. Antes de exportar, uma linha sob **Download** lista as músicas que a credencial vai registrar; depois da exportação, a mesma linha informa o que a leitura do arquivo entregue encontrou. Desmarque **C2PA Credentials** para deixar o registro de fora. Uma imagem estática não registra música, porque não tem som. O `lolly mix` e o [servidor MCP](/info/mcp.html) gravam o mesmo registro.

## Arquivos do utilitário Rondocode

A maioria dos utilitários no dispositivo não grava credencial, porque transforma um arquivo que já é seu. O Rondocode cria áudio novo, então todo arquivo de áudio que ele grava carrega Content Credentials que registram a música como origem: o nome dela, o SHA-256 do arquivo `.rondo.json` e onde o código dela rodou. Isso cobre WAV, MP3, M4A, Opus, FLAC, cada stem em um ZIP de stems e uma gravação do que está tocando.

- As renderizações do próprio editor rodam no quadro privado dele (a classe de execução `frame`) e registram a versão do editor.
- Uma renderização feita pela CLI ou por um link de compartilhamento roda na classe `vm` e registra a versão e a semente do renderizador.
- Um WAV também informa o mesmo no comentário RIFF.
- A música calculada a partir do código da música é mídia algorítmica e não é marcada como IA.

Quando uma música canta, o arquivo declara esse canto como gerado por IA em forma legível por máquina. O tipo de fonte digital da credencial é mídia composta feita com modelos treinados, o registro lista as partes cantadas, e uma divulgação de IA C2PA por modelo identifica cada modelo pelo qual o canto passou: texto para fala Supertonic-3, o alinhador de fonemas wav2vec 2.0, o codificador ContentVec e a voz RVC, com o repositório e o commit de onde o Lolly o hospeda. Um arquivo que contém canto sintetizado nunca é salvo sem essa declaração.

Um arquivo MIDI não tem lugar para uma credencial, então um evento de texto no arquivo carrega a declaração no lugar, e o painel de exportação avisa isso. O painel descreve tudo isso antes de você exportar, e depois de cada exportação o editor lê o arquivo salvo de volta e informa apenas o que essa leitura encontrou.

Para o que as Content Credentials registram em geral, veja [Export a file](/info/exporting.html#content-credentials-c2pa).
