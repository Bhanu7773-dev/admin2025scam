import cheerio from "cheerio";

class MatkaService {
    static baseUrl = "https://sattamatkano1.me";

    /**
     * Fetches HTML content from a given endpoint.
     * @param {string} [endpoint="/"] - The endpoint to fetch from.
     * @returns {Promise<string|null>} The HTML content as text, or null if an error occurs.
     */
    async get(endpoint = "/") {
        try {
            const response = await fetch(MatkaService.baseUrl + endpoint);
            if (!response.ok) {
                console.error(`Request failed with status: ${response.status}`);
                return null;
            }
            return await response.text();
        } catch (err) {
            console.error("An error occurred during the GET request:", err);
            return null;
        }
    }

    /**
     * Scrapes the fast and live results from the homepage.
     * @returns {Promise<Object|null>} An object containing fastResult and liveResult arrays, or null on failure.
     */
    async getResults() {
        try {
            const html = await this.get("/");
            if (!html) return null;

            const $ = cheerio.load(html);

            const fastestResultUpdates = $(".resultsecond > div")
                .map((_, el) => ({
                    title: $(el).find("p.blue").text().trim(),
                    code: $(el).find("p.liveBlack").text().trim(),
                }))
                .get();

            const resultsLive = $(".result123 > div.frame")
                .map((_, el) => ({
                    title: $(el).find("p.fontframe").text().trim(),
                    code: $(el).find("p.black").text().trim(),
                    type: $(el).find("p.ribbon").text().trim(),
                    timeStart: $(el).find("p.time_left").text().trim(),
                    timeEnd: $(el).find("p.time_right").text().trim(),
                    url: $(el).find("a").attr("href"),
                }))
                .get();

            return {
                fastResult: fastestResultUpdates,
                liveResult: resultsLive,
            };
        } catch (err) {
            console.error("An error occurred during getResults parsing:", err);
            return null;
        }
    }

    /**
     * Scrapes the historical weekly chart data for a given game ID.
     * @param {string} id - The ID of the chart to scrape (e.g., "kalyan-chart").
     * @returns {Promise<Object[]>} An array of weekly result objects.
     */
    async getChart(id) {
        const html = await this.get(`/${id}.php`);
        if (!html) return [];

        const $ = cheerio.load(html);
        const rows = $("tbody tr").slice(1);

        const weeklyResults = [];
        const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

        rows.each((_, row) => {
            const cells = $(row).children();
            if (cells.length < 1) return;

            const dateRange = $(cells[0]).text().trim().replace(/\s+/g, " ");
            const dailyResultsForWeek = [];

            for (let i = 0; i < 7; i++) {
                const dayStartIndex = 1 + i * 3;
                if (dayStartIndex + 2 >= cells.length) continue;

                const openingPannaCell = $(cells[dayStartIndex]);
                const jodiCell = $(cells[dayStartIndex + 1]);
                const closingPannaCell = $(cells[dayStartIndex + 2]);

                const openingPanna = openingPannaCell.text().trim().replace(/\s+/g, "");
                const jodi = jodiCell.text().trim();
                const closingPanna = closingPannaCell.text().trim().replace(/\s+/g, "");

                const isHoliday = (jodiCell.html()?.includes('color="red"') ?? false) && isNaN(parseInt(jodi));

                dailyResultsForWeek.push({
                    dayOfWeek: days[i],
                    isClosed: isHoliday,
                    openingPanna: isHoliday ? "***" : openingPanna,
                    jodi: isHoliday ? "**" : jodi,
                    closingPanna: isHoliday ? "***" : closingPanna,
                });
            }

            weeklyResults.push({
                dateRange,
                results: dailyResultsForWeek,
            });
        });

        return weeklyResults;
    }
}

export { MatkaService }