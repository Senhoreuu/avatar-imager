export interface IAvatarFigureContainer
{
    getPartTypeIds(): string[];
    hasPartType(_arg_1: string): boolean;
    getPartCount(_arg_1: string): number;
    getPartSetId(_arg_1: string, index?: number): number;
    getPartColorIds(_arg_1: string, index?: number): number[];
    updatePart(_arg_1: string, _arg_2: number, _arg_3: number[], index?: number): void;
    appendPart(_arg_1: string, _arg_2: number, _arg_3: number[]): void;
    removePart(_arg_1: string): void;
    getFigureString(): string;
}
