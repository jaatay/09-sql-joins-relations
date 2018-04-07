'use strict';

const pg = require('pg');
const fs = require('fs');
const express = require('express');
const PORT = process.env.PORT || 3000;
const app = express();

const conString = 'postgres://postgres:82469173@localhost:5432/lab_09';
const client = new pg.Client(conString);
client.connect();
client.on('error', error => {
  console.error(error);
});

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static('./public'));

// REVIEW: These are routes for requesting HTML resources.
app.get('/new', (request, response) => {
  response.sendFile('new.html', {root: './public'});
});

// REVIEW: These are routes for making API calls to enact CRUD operations on our database.
app.get('/articles', (request, response) => {
  client.query(`
  SELECT * FROM authors
  INNER JOIN articles
  ON author.id=articles.author_id;
  `)
    .then(result => {
      response.send(result.rows);
    })
    .catch(err => {
      console.error(err)
    });
});

app.post('/articles', (request, response) => {
  client.query(
    `INSERT INTO authors (author, "authorUrl")
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;
    `,
    [
      request.body.author,
      request.body.authorUrl
    ],
    function(err) {
      if (err) console.error(err);
      // REVIEW: This is our second query, to be executed when this first query is complete.
      queryTwo();
    }
  )

  function queryTwo() {
    client.query(
      `SELECT author_id FROM authors WHERE author_id =$1
      `,
      [request.body.author_id],
      function(err, result) {
        if (err) console.error(err);

        // REVIEW: This is our third query, to be executed when the second is complete. We are also passing the author_id into our third query.
        queryThree(result.rows[0].author_id);
      }
    )
  }

  function queryThree(author_id) {
    // In the third query, add the SQL commands to insert the new article using the author_id from the second query. Add the data from the new article, including the author_id, as data for the SQL query.
    client.query(
      `INSERT INTO articles(article_id, author_id, title, category, "publishedOn", body)
      VALUES ($1, $2, $3, $4, $5, $6);
      `,
      [request.body.article_id, 
        author_id,
        request.body.title,
        request.body.category,
        request.body.publishedOn,
        request.body.body
      ],
      function(err) {
        if (err) console.error(err);
        response.send('insert complete');
      }
    );
  }
});

app.put('/articles/:id', function(request, response) {
  client.query(
    `INSERT INTO authors (author_id, author, "authorUrl") 
    VALUES ($1, $2, $3)
    `,
    [
      request.body.author_id,
      request.body.author,
      request.body.authorUrl
    ]
  )
    .then(() => {
      client.query(
        `UPDATE articles
        SET 
        article_id = $1
        author_id = $2 
        title = $3
        category = $4
        "publishedOn" = $5
         body = $6; 
        `,
        [request.body.article_id, 
          request.body.author_id,
          request.body.title,
          request.body.category,
          request.body.publishedOn,
          request.body.body]
      )
    })
    .then(() => {
      response.send('Update complete');
    })
    .catch(err => {
      console.error(err);
    })
});

app.delete('/articles/:id', (request, response) => {
  client.query(
    `DELETE FROM articles WHERE article_id=$1;`,
    [request.params.id]
  )
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err)
    });
});

app.delete('/articles', (request, response) => {
  client.query('DELETE FROM articles')
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err)
    });
});

// REVIEW: This calls the loadDB() function, defined below.
loadDB();

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}!`);
});


//////// ** DATABASE LOADERS ** ////////
////////////////////////////////////////

// REVIEW: This helper function will load authors into the DB if the DB is empty.
function loadAuthors() {
  fs.readFile('./public/data/hackerIpsum.json', 'utf8', (err, fd) => {
    JSON.parse(fd).forEach(ele => {
      client.query(
        'INSERT INTO authors(author, "authorUrl") VALUES($1, $2) ON CONFLICT DO NOTHING',
        [ele.author, ele.authorUrl]
      )
    })
  })
}

// REVIEW: This helper function will load articles into the DB if the DB is empty.
function loadArticles() {
  client.query('SELECT COUNT(*) FROM articles')
    .then(result => {
      if(!parseInt(result.rows[0].count)) {
        fs.readFile('./public/data/hackerIpsum.json', 'utf8', (err, fd) => {
          JSON.parse(fd).forEach(ele => {
            client.query(`
            INSERT INTO
            articles(author_id, title, category, "publishedOn", body)
            SELECT author_id, $1, $2, $3, $4
            FROM authors
            WHERE author=$5;
            `,
            [ele.title, ele.category, ele.publishedOn, ele.body, ele.author]
            )
          })
        })
      }
    })
}

// REVIEW: Below are two queries, wrapped in the loadDB() function, which create separate tables in our DB, and create a relationship between the authors and articles tables.
// THEN they load their respective data from our JSON file.
function loadDB() {
  client.query(`
    CREATE TABLE IF NOT EXISTS
    authors (
      author_id SERIAL PRIMARY KEY,
      author VARCHAR(255) UNIQUE NOT NULL,
      "authorUrl" VARCHAR (255)
    );`
  )
    .then(data => {
      loadAuthors(data);
    })
    .catch(err => {
      console.error(err)
    });

  client.query(`
    CREATE TABLE IF NOT EXISTS
    articles (
      article_id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES authors(author_id),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(20),
      "publishedOn" DATE,
      body TEXT NOT NULL
    );`
  )
    .then(data => {
      loadArticles(data);
    })
    .catch(err => {
      console.error(err)
    });
}
