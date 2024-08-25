"use strict";

const fs = require('fs');
const url = require('url');
const https = require('https');
const express = require('express');
const { query, validationResult } = require('express-validator');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const {getBooks, insertBooks, insertReview, getReviews, getSimilarBooks} = require('./models/dao');

// Spostare in init

// Init application
const app = express();

// Per gestire le sessioni degli utenti
app.use(session({
    secret: 'RA99J0YX3s6Jjjy0D0e6qpGgA',
    resave: false,
    saveUninitialized: false
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/javascripts', express.static(path.join(__dirname, 'public/javascripts')));
app.use('/css', express.static(path.join(__dirname, 'public/stylesheets')));

// Init passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((username, password, done) => {
    User.findByUsername(username, (err, user) => {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Incorrect username.' }); }
        if (!user.verifyPassword(password)) { return done(null, false, { message: 'Incorrect password.' }); }
        return done(null, user);
    });
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

// serialize and de-serialize the user (user object <-> session)
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    usersdao.getUser(id).then((user) => {
        done(null, user);
    })
        .catch((err) => {
            done(err, user);
        });
});

app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    console.log({ username, email, password });
    /*
    User.create({ username, password }, (err, user) => {
        if (err) {
            res.status(500).send('Errore nella registrazione.');
        } else {
            res.redirect('/login');
        }
    });*/
});

// Route per il login
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true // Se usi flash messages
}));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/register.html'));
});

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
            cover_path = `/images/covers/isbn${isbn.slice(5)}.jpg`;
            await downloadImage(book.cover.large, 'public' + cover_path);
        }
        else
        {
            cover_path = '/images/covers/default.jpg';
        }
        // TODO fix se non ci sono autori o pubblicatori
        books[isbn.slice(5)] = {
            isbn: isbn.slice(5),
            title: book.title,
            authors: book.authors === undefined ? "null" : book.authors.map(author => author.name).join(', '),
            publish_date: book.publish_date,
            publishers: book.publishers === undefined ? "null" : book.publishers.map(publisher => publisher.name).join(', '),
            cover_path: cover_path
        };
    }

    return books;
}

// TODO speed up che cerca prima nel db locale
async function searchBook(title)
{
    const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=10`, {
        method: 'GET',
        headers: {'User-Agent': 'BookReviewHub/1.0'}
    });
    if(!response.ok)
    {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if(data.numFound > 0)
    {
        // Il primo libro in ordine che ha un isbn valido, operatore ?. per non dare errore se son tutti undefined
        const isbns = data.docs.find(doc => doc.isbn !== undefined)?.isbn;
        if(isbns !== undefined) {
            const books = await fetchBooks([isbns[0]]);
            return books[Object.keys(books)[0]];
        }
    }
    return null;
}

/**
 * Restituisce titoli simili a title
 * @param title
 * @returns {Promise<void>} {isbn: title, ...}
 */
async function searchTitles(title)
{
    const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=10`, {
        method: 'GET',
        headers: {'User-Agent': 'BookReviewHub/1.0'}
    });
    if(!response.ok)
    {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if(data.numFound > 0)
    {
        const titles = {};
        data.docs.forEach(doc => {
            if(doc.isbn !== undefined)
            {
                titles[doc.isbn[0]] = doc.title;
            }
        });
        return titles;
    }
    return null;
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
    let book;
    const queriedBooks = await getBooks([req.params.bookId]);

    // Se è un nuovo libro non ancora presente nel db
    if(Object.keys(queriedBooks).length === 0)
    {
        const books = await fetchBooks([req.params.bookId]);
        if(Object.keys(books).length !== 0) insertBooks(books);
        book = books[req.params.bookId];
    }
    else book = queriedBooks[req.params.bookId];

    const user = {connected: true, profilePicture: '/images/propic.png'};
    const daoReviews = await getReviews(req.params.bookId);

    const reviews = daoReviews.map(({ user: username, date: datetime, text: comment, stars: rate }) => ({ username, datetime, comment, rate }));

    res.render(path.join(__dirname, 'views/book.ejs'), {user, book, reviews});
});

// TODO speed up si salvano gia nel db questi risultati consigliando i 3 libri piu simili richiesti tramite api
app.get('/autocomplete-title', async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title } = req.query;

    try
    {
        // const resultss = await getSimilarBooks(title);

        const results = await searchTitles(title);

        if(results !== null)
        {
            res.json(Object.values(results).map(value => ({ title: value })));
        }
        else res.json({});
    }
    catch(error)
    {
        console.error('Error executing query', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/search-title', async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title } = req.query;

    try
    {
        // res.json(book);

        const book = await searchBook(title);
        if(book !== null)
        {
            const user = {connected: true, profilePicture: '/images/propic.png'};
            const daoReviews = await getReviews(book.isbn);

            const reviews = daoReviews.map(({ user: username, date: datetime, text: comment, stars: rate }) => ({ username, datetime, comment, rate }));

            res.render(path.join(__dirname, 'views/book.ejs'), {user, book, reviews});
        }
        else res.status(200).send('Libro non trovato');
    }
    catch(error)
    {
        console.error('Error executing query', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/add-comment', (req, res) => {
    const {isbn, comment, rate} = req.body;
    // const username = req.user.username; // Assicurati che `req.user` sia popolato quando l'utente è autenticato

    insertReview(isbn, Number(isbn), Number(rate), comment);
    res.status(201).json({
        username: Number(isbn),
        datetime: new Date().toISOString(), // Puoi usare il formato desiderato
        comment,
        rate: Number(rate)
    });
});

app.listen(3000, () => console.log('Running on http://127.0.0.1:3000'));