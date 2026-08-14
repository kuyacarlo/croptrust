export const truncate = (item : string, limit: number): string =>  {
    return  item.length > limit ? item.slice(0, limit) + "..." : item;

}
