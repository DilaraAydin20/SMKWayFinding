const apiUrl = 'https://api.smk.dk/api/v1/art/search/';

let offset = 0; // Gathering artworks from offset (index)
const rows = 20; // Amount of rows being searched at once

export async function getArtworks(){
    try {
        const response = await fetch(
            `${apiUrl}?keys=*&offset${offset}&rows=${rows}`
        );
        const data = await response.json();
        console.log(data);

    } catch(err){
        console.error('Error while retreiving artworks :', err);
    }
}

getArtworks();