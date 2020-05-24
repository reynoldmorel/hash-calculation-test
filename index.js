const http = require('http');
const crypto = require('crypto');

const store = {};
const initialHashes = {};
const initialStats = {
    active: 0,
    max_payload: 0,
    average_payload: 0,
    average_time_per_mb: 0,
    sum_payload: 0,
    sum_time_per_mb: 0
};
const initialValues = { stats: initialStats, hashes: initialHashes };

const hashcalcFn = (req, res) => {
    const { headers } = req;
    const md5Hash = crypto.createHash('md5');

    let body = "";

    req.on("data", (chunk) => {
        body = `${body}${chunk}`;
    });

    req.on("end", () => {
        const content = body;
        const startTime = new Date().getTime();
        const hashResult = md5Hash.update(content).digest("hex");
        const endTime = new Date().getTime();

        const serverRequester = headers.host;
        const payloadSize = content.length;
        const hashingTimeSpent = endTime - startTime;

        // Updating host report
        store[serverRequester] = store[serverRequester] || initialValues;
        const hostData = store[serverRequester];

        hostData.hashes[hashResult] = content;

        hostData.stats.active = hostData.stats.active + 1;

        if (hostData.stats.max_payload < payloadSize) {
            hostData.stats.max_payload = payloadSize;
        }

        hostData.stats.sum_payload = hostData.stats.sum_payload + payloadSize;
        hostData.stats.average_payload = hostData.stats.sum_payload / hostData.stats.active;
        const timePerMb = (1048576 * hashingTimeSpent) / payloadSize;
        hostData.stats.sum_time_per_mb = hostData.stats.sum_time_per_mb + timePerMb;
        hostData.stats.average_time_per_mb = hostData.stats.sum_time_per_mb / hostData.stats.active;
        // Finished updating host report

        const payload = {
            host: serverRequester,
            hash: hashResult,
            time: hashingTimeSpent,
            size: payloadSize
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
    });
};

const statsFn = (req, res) => {
    const { headers } = req;
    const serverRequester = headers.host;
    store[serverRequester] = store[serverRequester] || initialValues;
    const hostData = store[serverRequester];

    const payload = {
        host: serverRequester,
        stats: {
            active: hostData.stats.active,
            max_payload: hostData.stats.max_payload,
            average_payload: hostData.stats.average_payload,
            average_time_per_mb: hostData.stats.average_time_per_mb
        }
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
};

const routes = [{
        method: "POST",
        url: "/hashcalc",
        fn: hashcalcFn
    },
    {
        method: "GET",
        url: "/stats",
        fn: statsFn
    }
];

const router = (req, res) => {
    for (const route of routes) {
        if (route.url === req.url && route.method === req.method) {
            route.fn(req, res);
            return;
        }
    }
    res.statusCode = 404;
    res.end();
};

const server = http.createServer(router);
server.listen(3000, () => console.log("Server started at port 3000"));