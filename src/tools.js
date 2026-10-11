// Short field-guide explanations. These describe the teaching shell's supported subset.
const tools = {
  pwd: ['Where am I?', 'Prints the folder you are working in. Use it before a move changes what a relative path means.', 'pwd'],
  whoami: ['Who am I?', 'Shows your lab account. Knowing your identity helps you understand your access.', 'whoami'],
  ls: ['What is here?', 'Lists nearby files. Add -la to see details and hidden files.', 'ls -la'],
  cd: ['Take a different path.', 'Changes your working directory. cd .. moves to the parent folder.', 'cd maps'],
  cat: ['Read the clue.', 'Displays the text inside a file. A filename is not the same as its contents.', 'cat briefing.txt'],
  echo: ['Leave a message.', 'Writes text to the terminal. With > you can save it, or >> to append it.', 'echo "Checked the route"'],
  mkdir: ['Make a place for your evidence.', 'Creates a directory in this simulated file system.', 'mkdir notes'],
  cp: ['Keep a copy.', 'Copies a file while keeping the source. Check what you copied before relying on it.', 'cp source.txt backup.txt'],
  mv: ['Move it carefully.', 'Moves or renames a file or folder. This changes where its path points.', 'mv old.txt new.txt'],
  touch: ['Start a blank note.', 'Creates an empty file if it does not already exist.', 'touch notes.txt'],
  find: ['Search the trail.', 'Finds paths below a directory. -name matches names; -type f asks for regular files.', 'find . -name "*.txt"'],
  grep: ['Find the useful line.', 'Filters text for a matching pattern. Use a file path or connect another command with a pipe.', 'grep "WARN" relay.log'],
  head: ['Read the beginning.', 'Shows the first lines of a file. -n sets how many lines you want.', 'head -n 2 relay.log'],
  tail: ['Read the latest entries.', 'Shows the last lines. In a log appended in time order, these are the newest events.', 'tail -n 3 relay.log'],
  tee: ['See it and save it.', 'Displays piped output while also saving a copy to a file.', 'ss -tuln | tee ports.txt'],
  sort: ['Group the pattern.', 'Sorts text lines so repeated values sit together.', 'sort addresses.txt'],
  uniq: ['Count the repeats.', 'Groups adjacent repeated lines. Use sort first, then uniq -c to count each group.', 'sort addresses.txt | uniq -c'],
  wc: ['Count the evidence.', 'With -l, counts newline-terminated lines. It helps summarize a file or pipeline.', 'wc -l notes.txt'],
  awk: ['Pick out one field.', 'This lab supports {print $NF} to extract the last field of each input line.', "awk '{print $NF}' relay.log"],
  chmod: ['Choose who gets access.', 'Changes simulated permission bits. 600 gives the owner read/write access and no access to other users.', 'chmod 600 private.txt'],
  sha256sum: ['Check the fingerprint.', 'Computes a SHA-256 hash. Compare it with a trusted reference to check integrity; hashing does not hide the content.', 'sha256sum route.conf'],
  base64: ['Change the representation.', 'Encodes text as Base64. -d decodes it. Encoding provides no confidentiality.', 'base64 -d message.txt'],
  nslookup: ['Look up the signpost.', 'Returns a simulated DNS answer for a documented lab hostname.', 'nslookup academy.test'],
  ping: ['Ask whether the path answers.', 'Sends a bounded simulated connectivity test. No reply alone does not prove a service is down.', 'ping -c 3 academy.test'],
  curl: ['Inspect the web response.', 'Requests simulated HTTP headers from a lab destination. Keep TLS verification enabled.', 'curl -I https://academy.test'],
  ss: ['See which doors are open.', 'Lists listening TCP/UDP sockets in the simulation. A listening port needs context, not an automatic verdict.', 'ss -tuln'],
  ps: ['Meet the processes.', 'Shows the simulated process inventory. Compare it with service and configuration evidence.', 'ps aux'],
  history: ['Retrace your moves.', 'Shows commands from this attempt. Up and Down also recall them.', 'history'],
  clear: ['A fresh view.', 'Clears the terminal display. Your verified evidence and files stay with you.', 'clear'],
  help: ['Open the toolkit.', 'Lists commands supported by Patch’s training shell.', 'help']
};
export function describeCommand(command) {
  const [title, text, example] = tools[command] || ['Your field tool', 'Use help to see this shell’s supported tools.', command];
  return {title, text, example};
}
