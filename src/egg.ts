// Easter egg. The credits refuse to say who made this, so the answer is hidden in the console:
// the bubbles in the flask spell it out in hex.

const FLASK = String.raw`
         ____
        |    |        THE CREDITS SAY <REDACTED>.
        |    |        THE ANSWER IS IN THE BUBBLES:
       /      \
      /  o  O  \          45 54 53 20 52 26 44
     /  O   o   \
    /____________\    ( hex -> ascii, and then
    \____________/      ask what the D stands for )
`;

export function printConsoleEgg(): void {
  const title = 'MEGA MANAGER';
  console.log(
    `%c${title}%c  an engineering onsite adventure\n%c${FLASK}`,
    'color:#3cbcfc;font-weight:bold;font-size:18px;font-family:monospace',
    'color:#a4e4fc;font-family:monospace',
    'color:#58d854;font-family:monospace;line-height:1.1',
  );
  console.log('%cKEEP IT BETWEEN US.', 'color:#f8d878;font-family:monospace');
}
