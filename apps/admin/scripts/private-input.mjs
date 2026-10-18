// Shared hidden input for private provisioning and acceptance testing.
// Never put prompts' values into errors, command arguments or reports.
import { StringDecoder } from "node:string_decoder";
export function hidden(prompt) {
  if(!process.stdin.isTTY||!process.stdout.isTTY)
    throw new Error("Use a private interactive terminal.");
  process.stdout.write(prompt);
  return new Promise((resolve,reject)=>{
    let value="";
    const decoder=new StringDecoder("utf8"),wasRaw=process.stdin.isRaw;
    const cleanup=()=>{process.stdin.off("data",read);process.stdin.setRawMode(!!wasRaw);process.stdin.pause();process.stdout.write("\n");};
    const read=bytes=>{
      for(const char of decoder.write(bytes)) {
        if(char==="\u0003"||char==="\u0004"){cleanup();reject(new Error("Cancelled; private input was not displayed."));return;}
        if(char==="\r"||char==="\n"){cleanup();resolve(value);return;}
        if(char==="\u007f"||char==="\b")value=Array.from(value).slice(0,-1).join("");
        else if(char>=" "&&value.length<4096)value+=char;
      }
    };
    process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on("data",read);
  });
}
