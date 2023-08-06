import axios from "axios";
import fs from "fs/promises"
import { parentPort } from "worker_threads";

parentPort.on("message", async (song) => {

  const blob = await axios.get(song.src, { responseType: "arraybuffer" })
  await fs.writeFile("./songs/" + song.title + ".mp3", blob.data)

  parentPort.postMessage("done")
  process.exit(0)

})