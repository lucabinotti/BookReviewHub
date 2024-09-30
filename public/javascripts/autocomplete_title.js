'use strict';

// Dava problemi perche' arrivavano troppe richieste per ogni lettera digitata
// document.getElementById('search-field').addEventListener('input', onInputSearch);

const onInputSearchDebounced = debounce(onInputSearch, 300);
document.getElementById('search-field').addEventListener('input', onInputSearchDebounced);

/**
 * Funzione di debounce, usata per limitare la frequenza con cui viene richiamata la funzione che gli si passa.
 * In questo caso specifico viene usata per evitare di inviare troppe richieste di suggerimenti quando si inserisce
 * un titolo nella barra di ricerca.
 */
function debounce(func, delay)
{
    // Timeout corrente
    let debounceTimeout;
    return function(...args) {
        // Cancella timeout precedente
        clearTimeout(debounceTimeout);
        // Imposta un nuovo timeout
        debounceTimeout = setTimeout(() => func(...args), delay);
    };
}

/**
 * Richiamata per avere suggerimenti per titoli simili all'input utente
 */
async function onInputSearch(event)
{
    const query = event.target.value;

    if(query.length < 1)
    {
        clearSuggestions();
    }
    else
    {
        try
        {
            const response = await fetch(`/autocomplete-title?title=${encodeURIComponent(query)}`);
            if(response.ok)
            {
                const suggestions = await response.json();
                if(Object.keys(suggestions).length !== 0)
                {
                    showSuggestions(suggestions);
                }
            }
            else console.error(`Error: ${response.status}`);
        }
        catch(error)
        {
            console.error('Error fetching autocomplete results:', error);
        }
    }
}

/**
 * Mostra i suggerimenti di autocomplete aggiornando il datalist.
 */
function showSuggestions(suggestions)
{
    clearSuggestions();
    const dataList = document.getElementById('suggestions');
    suggestions.forEach((suggestion, i) => {
        const option = document.createElement('option');
        option.value = suggestion.title;
        dataList.appendChild(option);
    });
}

/**
 * Pulisce i suggerimenti di autocomplete dal datalist.
 */
function clearSuggestions()
{
    const dataList = document.getElementById('suggestions');

    // Per evitare: dataList.innerHTML = '';
    while(dataList.firstChild)
    {
        dataList.removeChild(dataList.firstChild);
    }
}
