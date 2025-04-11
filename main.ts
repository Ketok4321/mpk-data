import { parse } from "https://deno.land/x/xml@6.0.4/parse.ts";

type Config = {
    dir: string;
    route: string;
    stops: string[];
}

const config: Config = JSON.parse(await Deno.readTextFile("config.json"));
await Deno.mkdir(config.dir, { recursive: true });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getStop(id: string) {
    const response = await fetch(`https://einfo.erzeszow.pl/Home/GetTimetableReal?busStopId=${id}`);
    const text = await response.text();
    return parse(text);
}

async function isOnStop(stopId: string, busId: string): Promise<boolean> {
    const stop = await getStop(stopId);
    const bus = stop.Schedules.Stop.Day.R.find((b) => b.S["@id"] == busId);
    if (bus) console.log(stop.Schedules.Stop["@name"], bus.S["@t"]);
    return bus != null;
}

class Observer {
    current_stop: number = 0;
    id: string;
    private interval: number;

    constructor(id: string) {
        this.id = id;
    }

    async init() {
        await this.observe();
        this.interval = setInterval(() => this.observe(), 30 * 1000);
    }

    async observe() {
        try {
            while (!await isOnStop(config.stops[this.current_stop], this.id)) {
                const now = new Date();
                const hours = now.getHours().toString().padStart(2, "0");
                const minutes = now.getMinutes().toString().padStart(2, "0");

                await Deno.writeTextFile(`${config.dir}/${this.id}.csv`, `${hours}:${minutes},${this.current_stop}\n`, { append: true });
                this.current_stop++;
                if (this.current_stop >= config.stops.length) clearInterval(this.interval);
                await sleep(100);
            }
        } catch (e) {
            console.error(`Bus ${this.id} encountered an exception when processing stop ${this.current_stop}.`);
            console.error(e);
        }
    }
}

const seen = new Set();

async function observeStart() {
    const stop = await getStop(config.stops[0]);
    stop.Schedules.Stop.Day.R.filter((b) => b["@nr"] == config.route).forEach((b) => {
        const id = b.S["@id"];
        if (!seen.has(id)) {
            seen.add(id);
            new Observer(id).init()
        }
    });
}

await observeStart();
setInterval(observeStart, 5 * 60);
