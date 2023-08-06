#!/usr/bin/env node

import ora from "ora";
import prompts from "prompts";
import puppeteer from "puppeteer";
import { Worker } from "worker_threads"
import EventEmitter from "events";

// argument parsing
let albumUrl = process.argv[2]

if (albumUrl === undefined || albumUrl.trim().length < 1) {

  albumUrl = (await prompts({
    name: "albumUrl",
    type: "text",
    message: "Please enter the url to the album."
  })).albumUrl

}

// start browser

const spinner1 = ora().start("Starting browser session")

const browser = await puppeteer.launch({
  headless: "new",
})
const page = await browser.newPage()

try {
  await page.goto(albumUrl)
}
catch {
  spinner1.fail("Failed to start browser session")
  process.exit(1)
}

spinner1.succeed("Started browser session")

// retrieve song list

const spinner2 = ora().start("Retrieving song list from album")

const audioElement = await page.waitForSelector("#audio1")
const songListElement = await page.waitForSelector("#songlist")

let songRowElements = await songListElement.$$("tbody tr")
songRowElements = songRowElements.slice(1, -1)

const songs = []

let count = 0

for (const row of songRowElements) {

  count++
  spinner2.text = "Retrieving song list from album (" + count + ")"

  const button = await row.$("td .playTrack")
  await button.click()
  const src = await audioElement.getProperty("src")

  const a = await row.$("td:nth-child(4) a")
  const title = await a.getProperty("innerText")

  songs.push({ 
    src: await src.jsonValue(),
    title: await title.jsonValue()
  })
}

spinner2.succeed("Retrieved " + songs.length + " songs from album")

// start worker

const spinner3 = ora().start("Downloading songs")

let index = 0
let currentWorkers = 0
const maxWorkers = 4
const emitter = new EventEmitter

for (const song of songs) {

  emitter.emit("check")

  currentWorkers++
  const worker = new Worker("./worker.js")
  worker.postMessage(song)
  worker.on("message", () => {
    currentWorkers--
    emitter.emit("check")
    index++
  })

  await new Promise((resolve) => {
    const callback = () => {
      if (currentWorkers < maxWorkers) {
        emitter.removeListener("check", callback)
        resolve()
      }
    }
    emitter.on("check", callback)
  })

  spinner3.text = "Downloading songs (" + index + "/" + songs.length + ")"

}

spinner3.succeed("Downloaded " + songs.length + " songs")

// exit application

await browser.close()
process.exit(0)
