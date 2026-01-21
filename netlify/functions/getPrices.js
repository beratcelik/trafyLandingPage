const products = {
  "Trafy Uno": "1500 TL",
  "Trafy Uno Pro": "2500 TL",
  "Trafy Dos": "4000 TL",
  "Trafy Dos Pro": "7000 TL",
  "Trafy Dos Internet": "8000 TL",
  "Trafy Tres": "9000 TL",
  "Trafy Tres Pro": "10000 TL"
};

exports.handler = async function () {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(products),
  };
};

