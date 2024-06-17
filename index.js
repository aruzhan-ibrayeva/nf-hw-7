const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const fs = require('fs').promises;
const cron = require('node-cron');
require('dotenv').config();

const app = express();

async function fetchData(url, retries = 3) {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    console.log("Fetched data successfully");
    return cheerio.load(data);
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${3 - retries + 1})`);
      return fetchData(url, retries - 1);
    } else {
      throw error;
    }
  }
}

async function parseProduct(url) {
  const $ = await fetchData(url);

  const products = [];
  const productElements = $(".catalog_item");

  console.log(`Found ${productElements.length} product elements`);

  productElements.each((index, element) => {
    const title = $(element)
      .find(".catalog_item__name")
      .text()
      .trim();
    const link = $(element)
      .attr("href");

    console.log(`Title: ${title}`);
    console.log(`Link: ${link}`);

    // Extracting prices
    let price = $(element)
      .find(".catalog_item__price")
      .text()
      .trim();

    console.log(`Price: ${price}`);

    // Fallback to empty string if price is not available
    price = price || "N/A";

    if (title && link) {
      products.push({
        title,
        price,
        link: `https://qazaqrepublic.com${link}`,
      });
    } else {
      console.log(`Skipping product element at index ${index} due to missing title or link`);
    }
  });

  console.log("Parsed products:", products); // Log parsed products
  return products;
}

async function saveProductsToFile(products, filename) {
  const data = JSON.stringify(products, null, 2);
  await fs.writeFile(filename, data, 'utf8');
  console.log(`Data saved to ${filename}`);
}

async function fetchAndSaveProducts() {
  const url = 'https://qazaqrepublic.com/en/shop?category=sale';
  try {
    const products = await parseProduct(url);
    if (products.length === 0) {
      console.log('No products found.');
    }
    await saveProductsToFile(products, 'products.json');
  } catch (error) {
    console.error('Failed to fetch and save products:', error.message);
  }
}

cron.schedule('0 * * * *', fetchAndSaveProducts);

app.get('/products', async (req, res) => {
  try {
    const data = await fs.readFile('products.json', 'utf8');
    const products = JSON.parse(data);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read products data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  fetchAndSaveProducts(); // Initial call to update products.json
});
