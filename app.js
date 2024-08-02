"use strict";

const fs = require('fs');
const url = require('url');
const https = require('https');
const express = require('express');
const path = require('path');
const {getBooks, insertBooks} = require('./models/dao');


const app = express();

app.use('/images', express.static(path.join(__dirname, 'public/images')))


function downloadImage(imageUrl, path) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'BookReviewHub/1.0'
            }
        };
        https.get(imageUrl, options, (res) => {
            if (res.statusCode === 302) {
                // Segui il reindirizzamento
                const redirectUrl = url.resolve(imageUrl, res.headers.location);
                downloadImage(redirectUrl, path).then(resolve).catch(reject);
            } else if (res.statusCode !== 200) {
                reject(new Error(`Failed to get '${imageUrl}' (${res.statusCode})`));
            } else {
                const file = fs.createWriteStream(path);
                res.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }
        }).on('error', (err) => {
            fs.unlink(path, () => reject(err)); // Elimina il file se c'è un errore
        });
    });
}


async function fetchBooks(isbns)
{
    // isbns.forEach(isbn => (isBookNew(isbn) ? newBooks : books).push(isbn));
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=${isbns.map(isbn => `ISBN:${isbn}`).join(',')}&jscmd=data&format=json`, {
        method: 'GET',
        headers: {'User-Agent': 'BookReviewHub/1.0'}
    });
    if (!response.ok)
    {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();

    const books = {};
    for(const [isbn, book] of Object.entries(data))
    {
        let cover_path;
        if(book.cover !== undefined)
        {
            cover_path = `images/covers/isbn${isbn.slice(5)}.jpg`;
            await downloadImage(book.cover.large, 'public/' + cover_path);
        }
        else
        {
            cover_path = 'images/covers/default.jpg'
        }
        books[isbn.slice(5)] = {
            isbn: isbn.slice(5),
            title: book.title,
            authors: book.authors.map(author => author.name).join(', '),
            publish_date: book.publish_date,
            cover_path: cover_path
        };
    }

    return books;
}

/*
https://openlibrary.org/search.json?title=cacca
http://openlibrary.org/api/books?bibkeys=ISBN:1408294222&format=json&jscmd=data

 */
app.get('/', async (req, res) => {
    // L'utente è connesso?
    // const user = {connected: false}
    const user = {connected: true, profilePicture: 'images/propic.png'};
    const isbns = ['8835088585', '1408294222', '8821561577'];
    const oldBooks = await getBooks(isbns);
    const newBooks = await fetchBooks(isbns.filter(isbn => !oldBooks.hasOwnProperty(isbn)));
    if(Object.keys(newBooks).length !== 0) insertBooks(newBooks);
    const books = Object.assign({}, oldBooks, newBooks);
    // const books = isbns.map(isbn => mostRatedBooks[`ISBN:${isbn}`]);

    // From db
    // const books = await getBooks(isbns);
    //     const newBooks = isbns.filter(isbn => !books.hasOwnProperty(isbn));

    res.render(path.join(__dirname, 'views/index.ejs'), {user, books});
});

app.get('/books/:bookId', async (req, res) => {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${req.params.bookId}&jscmd=data&format=json`, {
        method: 'GET',
        headers: {'User-Agent': 'MyAppName/1.0'}
    });
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const fetchedData = await response.json();
    const fetchedBook = fetchedData[`ISBN:${req.params.bookId}`];
    // res.json({
    //     isbn: req.params.bookId,
    //     title: book.title,
    //     authors: book.authors.map(author => author.name),
    //     publish_date: book.publish_date,
    //     cover: book.cover
    // });
    const book = {
        isbn: req.params.bookId,
        title: fetchedBook.title,
        authors: fetchedBook.authors.map(author => author.name),
        publish_date: fetchedBook.publish_date,
        cover: fetchedBook.cover !== undefined ? fetchedBook.cover.large : '/images/covers/default.jpg',
        publishers: fetchedBook.publishers.map(publisher => publisher.name)
    };
    res.render(path.join(__dirname, 'views/book.ejs'), {book, reviews: [
             {
                 username: 'Username1',
                 datetime: '2023-07-24 10:30',
                 comment: 'Recensione molto positiva, ho trovato il libro fantastico!',
                 rate: 4
             },
             {
                 username: 'Username2',
                 datetime: '2023-07-23 14:20',
                 comment: 'Il libro è interessante ma alcuni capitoli erano noiosi.',
                 rate: 3
             },
             {
                 username: 'Username3',
                 datetime: '2023-07-22 09:15',
                 comment: 'Non mi è piaciuto molto, mi aspettavo di più.',
                 rate: 2
             }
         ]});
});

/* REST API di esempio
 * collection: http://127.0.0.1:3000/users
 * user: http://127.0.0.1:3000/users/1
 */
app.get('/users/', (req, res) => {
    db.all('SELECT * FROM User', (err, row) => {
        res.json({users: row});
    });
});

app.get('/users/:userId', (req, res) => {
    db.get('SELECT * FROM User WHERE user_id = ?', req.params.userId, (err, row) => {
        res.json({user: row});
    });
});

app.post('/users/:userId', (req, res) => {
    console.log('Pulcina: ', req.params.userId);
    db.run('INSERT INTO User (user_id) VALUES (?)', req.params.userId);
    res.status(201).send('Risorsa inserita');
});

app.get('/users_post/:userId', async (req, res) => {
    const response = await fetch('http://localhost:3000/users/' + req.params.userId, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    });
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    res.status(201).send('Risorsa inserita');
});

app.get('/books/:bookId', async (req, res) => {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${req.params.bookId}&format=json`, {
        method: 'GET',
        headers: {
            'User-Agent': 'MyAppName/1.0',
        }
    });
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    res.json(await response.json());
});

app.listen(3000, () => console.log('Running on http://127.0.0.1:3000'));